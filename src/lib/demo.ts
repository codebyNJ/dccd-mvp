import { mulberry32, planTrials, stepSeed } from "./counterbalance";
import { teachableItems } from "./lessons";
import { applySession, delaySecondsFor, independentPercent } from "./progress";
import { defaultProgress, defaultSettings, type Learner, type Lesson, type PromptLevel, type Session, type Side, type TrialRecord } from "./schema";
import { summarize } from "./session";
import { unpromptedErrors } from "./trial";

const DAY = 86_400_000;
const other = (s: Side): Side => (s === "left" ? "right" : "left");

/** Probability of an independent correct answer for one trial of a simulated child. */
type Skill = (verb: string, side: Side, sessionIndex: number) => number;

interface Plan {
  learner: Learner;
  lesson: Lesson;
  days: number[]; // days ago, oldest first
  skill: Skill;
  /** When the child doesn't know, how often they tap the wrong card first (vs. waiting for a prompt). */
  guessRate?: number;
}

function simulate(plan: Plan, rng: () => number, now: number): Session[] {
  const items = teachableItems(plan.lesson);
  const byId = new Map(items.map((i) => [i.id, i]));
  const ids = items.map((i) => i.id);
  const sessions: Session[] = [];
  let progress = plan.learner.progress[plan.lesson.id] ?? defaultProgress();
  const settings = plan.learner.settings;

  plan.days.forEach((daysAgo, k) => {
    const startedAt = now - daysAgo * DAY + Math.floor(rng() * 3) * 3_600_000 - 10 * 3_600_000;
    const seed = Math.floor(rng() * 2 ** 31);
    const delaySeconds = settings.strategy === "errorless" ? delaySecondsFor(progress.delayStep) : 0;
    let t = startedAt + 90_000; // after Watch
    const trials: TrialRecord[] = [];
    const push = (r: Omit<TrialRecord, "at" | "latencyMs">, slow = false) => {
      const latencyMs = Math.round((slow ? 2600 : 1100) + rng() * 2400);
      t += latencyMs + 4200;
      trials.push({ ...r, latencyMs, at: t });
    };

    for (const p of planTrials(ids, stepSeed(seed, "practise"), k)) {
      const verb = byId.get(p.itemId)!.verb;
      const base = { itemId: p.itemId, step: "practise" as const, correctSide: p.correctSide };
      const knows = rng() < plan.skill(verb, p.correctSide, k);
      if (settings.strategy === "errorless" && delaySeconds === 0) {
        push({ ...base, tappedSide: p.correctSide, correct: true, promptLevel: 3, correction: false });
      } else if (knows) {
        push({ ...base, tappedSide: p.correctSide, correct: true, promptLevel: 0, correction: false });
      } else if (rng() < (plan.guessRate ?? 0.5)) {
        push({ ...base, tappedSide: other(p.correctSide), correct: false, promptLevel: 0, correction: false });
        push({ ...base, tappedSide: p.correctSide, correct: true, promptLevel: 3, correction: true }, true);
      } else {
        const level = (settings.strategy === "errorless" ? 3 : 1 + Math.floor(rng() * 3)) as PromptLevel;
        push({ ...base, tappedSide: p.correctSide, correct: true, promptLevel: level, correction: false }, true);
      }
    }
    for (const p of planTrials(ids, stepSeed(seed, "check"), k + Math.floor(ids.length / 2))) {
      const verb = byId.get(p.itemId)!.verb;
      const ok = rng() < plan.skill(verb, p.correctSide, k);
      push({ itemId: p.itemId, step: "check", correctSide: p.correctSide, tappedSide: ok ? p.correctSide : other(p.correctSide), correct: ok, promptLevel: 0, correction: false });
    }

    const breaks = rng() < 0.35 ? [{ start: startedAt + 200_000, end: startedAt + 200_000 + 40_000 + Math.floor(rng() * 60_000) }] : [];
    const endedAt = t + 20_000;
    const session: Session = {
      id: `demo-${plan.learner.id}-${plan.lesson.id}-${k}`,
      learnerId: plan.learner.id,
      lessonId: plan.lesson.id,
      kind: "lesson",
      seed,
      startedAt,
      endedAt,
      completed: true,
      strategy: settings.strategy,
      delaySeconds,
      reward: (["bubbles", "stars", "fish"] as const)[k % 3],
      breaks,
      trials,
      summary: summarize({ trials, breaks }, endedAt),
    };
    sessions.push(session);
    const res = applySession(
      progress,
      {
        kind: "lesson",
        completed: true,
        percent: independentPercent(trials),
        strategy: settings.strategy,
        practiseUnpromptedErrors: settings.strategy === "errorless" ? unpromptedErrors(trials.filter((r) => r.step === "practise")) : null,
      },
      settings,
      endedAt,
    );
    progress = res.progress;
    if (res.becameMastered && !plan.learner.stickers.includes(plan.lesson.id)) plan.learner.stickers.push(plan.lesson.id);
  });
  plan.learner.progress[plan.lesson.id] = progress;
  return sessions;
}

/**
 * Two demo learners with realistic, deterministic histories:
 *  - Asha: errorless; mastered Can (review now due); Can't in progress —
 *    strong on the lion questions, still needs help with who can't roar.
 *  - Kabir: least-to-most; Can in progress with a right-side bias.
 */
export function makeDemoData(lessons: Lesson[], now: number): { learners: Learner[]; sessions: Session[] } {
  const rng = mulberry32(20260929);
  const can = lessons.find((l) => l.polarity === "can");
  const cant = lessons.find((l) => l.polarity === "cant");
  const asha: Learner = {
    id: "demo-asha",
    nickname: "Asha",
    avatar: "sun",
    createdAt: now - 30 * DAY,
    demo: true,
    settings: { ...defaultSettings(), calmMode: false },
    progress: {},
    stickers: [],
    assigned: lessons.map((l) => l.id),
  };
  const kabir: Learner = {
    id: "demo-kabir",
    nickname: "Kabir",
    avatar: "kite",
    createdAt: now - 20 * DAY,
    demo: true,
    settings: { ...defaultSettings(), strategy: "least-to-most", tokenBoardSize: 3 },
    progress: {},
    stickers: [],
    assigned: lessons.map((l) => l.id),
  };

  const sessions: Session[] = [];
  if (can) {
    const growth = [0.55, 0.7, 0.85, 0.97, 1, 1];
    sessions.push(...simulate({ learner: asha, lesson: can, days: [21, 19, 17, 14, 12, 10], skill: (_v, _s, k) => growth[k] }, rng, now));
    // Kabir mostly picks the right-hand card: right-side trials look correct, left-side ones don't.
    sessions.push(
      ...simulate({ learner: kabir, lesson: can, days: [13, 11, 8, 6, 3, 1], skill: (_v, side, k) => (side === "right" ? 0.99 : 0.12 + k * 0.02), guessRate: 0.92 }, rng, now),
    );
  }
  if (cant) {
    const skill: Skill = (verb, _s, k) => {
      if (verb === "climb a tree" || verb === "sing") return 0.97; // the lion questions
      if (verb === "roar") return 0.12;
      return 0.45 + k * 0.14;
    };
    sessions.push(...simulate({ learner: asha, lesson: cant, days: [8, 6, 4, 2], skill }, rng, now));
  }
  return { learners: [asha, kabir], sessions };
}
