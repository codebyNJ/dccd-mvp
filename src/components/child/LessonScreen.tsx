"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { S, VOICE } from "@/config/strings";
import { TEACHING } from "@/config/teaching";
import { TIMING, timeScale } from "@/config/timing";
import { newSeed, planTrials, rotate, sideSequence, stepSeed, type PlannedTrial } from "@/lib/counterbalance";
import { teachableItems } from "@/lib/lessons";
import { delaySecondsFor, isLocked, lessonStatus } from "@/lib/progress";
import { defaultProgress, type Learner, type Lesson, type RewardId, type Session, type Side, type TrialRecord } from "@/lib/schema";
import { summarize } from "@/lib/session";
import { instructionLine, praiseLine, teachLine, correctCharacter } from "@/lib/templates";
import { addToken, earnsToken } from "@/lib/tokens";
import { preloadLines, speak, stopSpeech } from "@/lib/voice";
import { useActiveLearner, useApp, type FinishResult } from "@/store/app";
import { BreakButton, BreakScreen, MuteButton } from "./BreakScreen";
import { GuideStar } from "./GuideStar";
import { ReadAlong } from "./ReadAlong";
import { RewardChoice } from "./RewardChoice";
import { RewardScene } from "./RewardScene";
import { Schedule, type ScheduleStep } from "./Schedule";
import { Sticker } from "./Sticker";
import { TokenBoard } from "./TokenBoard";
import { TrialStep } from "./TrialStep";
import { WatchSlide } from "./WatchSlide";

type Stage = "choose" | "watch" | "practise" | "check" | "missed-offer" | "missed" | "reward";

const SCHEDULE: Record<Stage, ScheduleStep> = {
  choose: "watch",
  watch: "watch",
  practise: "practise",
  check: "check",
  "missed-offer": "check",
  missed: "practise",
  reward: "reward",
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms * timeScale()));

export function LessonScreen() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const learner = useActiveLearner();
  const lessons = useApp((s) => s.lessons);
  const lesson = lessons.find((l) => l.id === id);

  let problem: string | null = null;
  if (!learner) problem = S.child.chooseLearnerFirst;
  else if (!lesson || !learner.assigned.includes(lesson.id)) problem = S.child.notAvailable;
  else if (isLocked(lesson, learner, lessons)) problem = S.child.lockedHint;
  else if (teachableItems(lesson).length < 2) problem = S.child.noItems;

  if (problem || !learner || !lesson) {
    return (
      <main className="child grid min-h-dvh place-items-center p-6 text-center">
        <div className="flex flex-col items-center gap-6">
          <p>{problem}</p>
          <Link href="/" className="child-btn primary">
            <Icon name="home" />
            {S.child.goHome}
          </Link>
        </div>
      </main>
    );
  }
  return <LessonRun key={`${learner.id}:${lesson.id}`} learner={learner} lesson={lesson} lessons={lessons} startStep={params.get("step")} />;
}

interface Plans {
  watch: { itemId: string; cantSide: Side }[];
  practise: PlannedTrial[];
  check: PlannedTrial[];
}

function LessonRun({ learner, lesson, lessons, startStep }: { learner: Learner; lesson: Lesson; lessons: Lesson[]; startStep: string | null }) {
  const router = useRouter();
  const muted = useApp((s) => s.muted);
  const setMuted = useApp((s) => s.setMuted);
  const saveSession = useApp((s) => s.saveSession);
  const finishSession = useApp((s) => s.finishSession);

  // Snapshot at the start: edits made mid-lesson never change a running session.
  const [items] = useState(() => teachableItems(lesson));
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [kind] = useState<Session["kind"]>(() => (lessonStatus(lesson, learner, lessons, Date.now()) === "review-due" ? "review" : "lesson"));
  const [priorSessions] = useState(
    () => useApp.getState().sessions.filter((x) => x.learnerId === learner.id && x.lessonId === lesson.id).length,
  );

  const settings = learner.settings;
  const calm = settings.calmMode;
  const voice = useMemo(() => ({ silent: muted || !settings.voiceOn, rate: settings.voiceRate }), [muted, settings.voiceOn, settings.voiceRate]);

  const [stage, setStage] = useState<Stage>("choose");
  const [reward, setReward] = useState<RewardId | null>(null);
  const [plans, setPlans] = useState<Plans | null>(null);
  const session = useRef<Session | null>(null);
  const [tokens, setTokens] = useState<{ filled: number; flying: { side: Side; slot: number } | null }>({ filled: 0, flying: null });
  const filled = useRef(0);
  const [boardFull, setBoardFull] = useState(false);
  const boardFullDone = useRef<(() => void) | null>(null);
  const [breakOpen, setBreakOpen] = useState(false);
  const [watchIndex, setWatchIndex] = useState(0);
  const [watchKey, setWatchKey] = useState(0);
  const [watchReady, setWatchReady] = useState(false);
  const [slideDone, setSlideDone] = useState(false);
  const [missed, setMissed] = useState<PlannedTrial[]>([]);
  const [result, setResult] = useState<FinishResult | null>(null);
  const [promptLine, setPromptLine] = useState<string>(VOICE.chooseReward);
  const [delaySeconds, setDelaySeconds] = useState(0);
  const [practiseDone, setPractiseDone] = useState(false);

  const persist = useCallback(() => session.current && saveSession({ ...session.current }), [saveSession]);

  // Keep ?step= in the URL in line with the lesson step.
  useEffect(() => {
    if (stage === "choose") return;
    const step = SCHEDULE[stage];
    router.replace(`/lesson/?id=${encodeURIComponent(lesson.id)}&step=${step}`, { scroll: false });
  }, [stage, lesson.id, router]);

  // Say the reward-choice line once the child has arrived (they tapped to get here).
  useEffect(() => {
    const s = speak(VOICE.chooseReward, voice);
    return () => s.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  const choose = (r: RewardId) => {
    stopSpeech();
    const seed = newSeed();
    const progress = learner.progress[lesson.id] ?? defaultProgress();
    const ids = items.map((i) => i.id);
    const reviewIds = rotate(ids, priorSessions).slice(0, TEACHING.reviewTrials);
    const watchSides = sideSequence(ids.length, stepSeed(seed, "watch"));
    setPlans({
      watch: ids.map((itemId, i) => ({ itemId, cantSide: watchSides[i] })),
      practise: planTrials(ids, stepSeed(seed, "practise"), priorSessions),
      check: kind === "review" ? planTrials(reviewIds, stepSeed(seed, "review"), 0) : planTrials(ids, stepSeed(seed, "check"), priorSessions + Math.floor(ids.length / 2)),
    });
    session.current = {
      id: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      learnerId: learner.id,
      lessonId: lesson.id,
      kind,
      seed,
      startedAt: Date.now(),
      endedAt: null,
      completed: false,
      strategy: settings.strategy,
      delaySeconds: settings.strategy === "errorless" ? delaySecondsFor(progress.delayStep) : 0,
      reward: r,
      breaks: [],
      trials: [],
      summary: null,
    };
    persist();
    preloadLines(
      items.flatMap((i) => [instructionLine(i, lesson.polarity), teachLine(i, lesson.polarity), praiseLine(i, lesson.polarity, correctCharacter(i, lesson.polarity))]).concat(Object.values(VOICE)),
    );
    setDelaySeconds(session.current.delaySeconds);
    setReward(r);
    setPromptLine(VOICE.scheduleWatch);
    const wanted = startStep === "practise" || startStep === "check" ? startStep : "watch";
    setStage(kind === "review" ? "check" : wanted);
  };

  // Watch: say the schedule line, then start the slides.
  useEffect(() => {
    if (stage !== "watch" || watchReady) return;
    const s = speak(VOICE.scheduleWatch, voice);
    void s.done.then(() => setWatchReady(true));
    return () => s.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per Watch step
  }, [stage]);

  const onRecord = useCallback(
    (r: TrialRecord) => {
      if (!session.current) return;
      session.current = { ...session.current, trials: [...session.current.trials, r] };
      persist();
    },
    [persist],
  );

  const onCorrect = useCallback(
    async (r: TrialRecord) => {
      if (!earnsToken(r, settings.tokensForPrompted)) return;
      const slot = filled.current;
      setTokens({ filled: slot, flying: { side: r.tappedSide, slot } });
      await sleep(320);
      const next = addToken(slot, settings.tokenBoardSize);
      filled.current = next.filled;
      setTokens({ filled: next.filled, flying: null });
      await sleep(TIMING.tokenFly * 1000);
      if (!next.full) return;
      // Board full: the chosen reward plays, then the board starts again.
      await new Promise<void>((res) => {
        boardFullDone.current = res;
        setBoardFull(true);
      });
      filled.current = 0;
      setTokens({ filled: 0, flying: null });
    },
    [settings.tokensForPrompted, settings.tokenBoardSize],
  );

  const endBoardFull = () => {
    stopSpeech();
    setBoardFull(false);
    boardFullDone.current?.();
    boardFullDone.current = null;
  };

  useEffect(() => {
    if (!boardFull) return;
    const s = speak(VOICE.boardFull, voice);
    return () => s.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per board
  }, [boardFull]);

  const finishCheck = () => {
    const s = session.current;
    if (!s) return;
    session.current = { ...s, completed: true };
    const r = finishSession(session.current, { practiseCompleted: practiseDone });
    setResult(r);
    const wrong = new Set(s.trials.filter((t) => (t.step === "check" || t.step === "review") && !t.correct).map((t) => t.itemId));
    if (kind === "lesson" && wrong.size > 0) {
      const ids = [...wrong];
      setMissed(planTrials(ids, stepSeed(s.seed, "missed"), 0));
      setPromptLine(S.child.missedTitle);
      speak(VOICE.missedPrompt, voice);
      setStage("missed-offer");
    } else goReward();
  };

  const goReward = () => {
    const s = session.current;
    if (s) {
      // Re-summarise (the missed-items practice may have added trials) and close.
      const now = Date.now();
      session.current = { ...s, endedAt: now, summary: summarize(s, now) };
      persist();
    }
    setStage("reward");
  };

  useEffect(() => {
    if (stage !== "reward") return;
    let alive = true;
    const s = speak(VOICE.scheduleReward, voice);
    void s.done.then(() => alive && speak(result?.becameMastered ? VOICE.newSticker : VOICE.allDone, voice));
    return () => {
      alive = false;
      stopSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on reward
  }, [stage]);

  const openBreak = () => {
    stopSpeech();
    if (session.current) {
      session.current = { ...session.current, breaks: [...session.current.breaks, { start: Date.now(), end: null }] };
      persist();
    }
    setBreakOpen(true);
  };
  const closeBreak = () => {
    const s = session.current;
    if (s) {
      session.current = { ...s, breaks: s.breaks.map((b) => (b.end === null ? { ...b, end: Date.now() } : b)) };
      persist();
    }
    setBreakOpen(false);
  };
  const stop = () => {
    stopSpeech();
    const s = session.current;
    if (s && s.endedAt === null) {
      if (s.completed) goReward();
      else finishSession(s, { practiseCompleted: practiseDone });
    }
    router.push("/");
  };

  const watchItem = plans && stage === "watch" ? itemMap.get(plans.watch[watchIndex]?.itemId ?? "") : undefined;
  const watchLast = plans ? watchIndex >= plans.watch.length - 1 : false;
  const nextSlide = useCallback(() => {
    if (!plans) return;
    setSlideDone(false);
    if (watchIndex >= plans.watch.length - 1) {
      stopSpeech();
      setStage("practise");
    } else setWatchIndex((i) => i + 1);
  }, [plans, watchIndex]);

  // Optional autoplay (off by default).
  useEffect(() => {
    if (!settings.watchAutoplay || !slideDone || breakOpen) return;
    const t = setTimeout(nextSlide, 1500 * timeScale());
    return () => clearTimeout(t);
  }, [settings.watchAutoplay, slideDone, breakOpen, nextSlide]);

  const trialCommon = {
    items: itemMap,
    polarity: lesson.polarity,
    strategy: settings.strategy,
    delaySeconds,
    pauseMs: settings.interTrialPauseMs,
    calm,
    voice,
    paused: breakOpen || boardFull,
    flyingToken: tokens.flying,
    onRecord,
    onCorrect,
  };

  return (
    <LayoutGroup>
      <main className={`child lesson ${settings.textSize === "large" ? "text-large" : ""}`} aria-label={lesson.title}>
        <div className="a-schedule">
          <Schedule current={SCHEDULE[stage]} skipped={kind === "review" ? ["watch", "practise"] : []} />
        </div>
        <div className="a-mute">
          <MuteButton muted={muted} onToggle={() => setMuted(!muted)} />
        </div>
        <div className="a-break">
          <BreakButton onClick={openBreak} />
        </div>
        <div className="a-tokens">
          <TokenBoard size={settings.tokenBoardSize} filled={tokens.filled} reward={reward} flying={tokens.flying?.slot ?? null} />
        </div>

        {stage === "practise" && plans && (
          <TrialStep key="practise" step="practise" plan={plans.practise} intro={VOICE.schedulePractise} {...trialCommon} onDone={() => (setPractiseDone(true), setStage("check"))} />
        )}
        {stage === "check" && plans && (
          <TrialStep key="check" step={kind === "review" ? "review" : "check"} plan={plans.check} intro={VOICE.scheduleCheck} {...trialCommon} onDone={finishCheck} />
        )}
        {stage === "missed" && <TrialStep key="missed" step="missed" plan={missed} {...trialCommon} onDone={goReward} />}

        {(stage === "choose" || stage === "watch" || stage === "missed-offer" || stage === "reward") && (
          <div className="a-prompt flex min-h-[1.3em] items-center gap-3">
            <GuideStar lean={null} calm={calm} size={64} />
            <div className="min-w-0 flex-1" aria-hidden>
              <ReadAlong
                text={
                  stage === "watch" && watchItem && watchReady
                    ? teachLine(watchItem, lesson.polarity)
                    : stage === "reward"
                      ? result?.becameMastered
                        ? VOICE.newSticker
                        : VOICE.allDone
                      : promptLine
                }
              />
            </div>
          </div>
        )}

        <div className="a-cards" hidden={stage === "practise" || stage === "check" || stage === "missed"}>
          <AnimatePresence mode="wait">
            {stage === "choose" && (
              <motion.div key="choose" className="h-full" exit={{ opacity: 0 }} transition={{ duration: TIMING.screenFade }}>
                <RewardChoice onChoose={choose} />
              </motion.div>
            )}
            {stage === "watch" && watchItem && watchReady && plans && (
              <motion.div key={`w-${watchIndex}-${watchKey}`} className="h-full" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                <WatchSlide
                  item={watchItem}
                  polarity={lesson.polarity}
                  cantSide={plans.watch[watchIndex].cantSide}
                  calm={calm}
                  voice={voice}
                  paused={breakOpen}
                  onFinished={() => setSlideDone(true)}
                />
              </motion.div>
            )}
            {stage === "missed-offer" && (
              <motion.div key="missed" className="grid h-full grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] content-center gap-[var(--gap)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <button className="child-btn primary min-h-[140px]" onClick={() => (stopSpeech(), setStage("missed"))}>
                  <Icon name="hand" />
                  {S.child.missedYes}
                </button>
                <button className="child-btn min-h-[140px]" onClick={() => (stopSpeech(), goReward())}>
                  <Icon name="gift" />
                  {S.child.missedNo}
                </button>
              </motion.div>
            )}
            {stage === "reward" && reward && (
              <motion.div key="reward" className="relative h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: TIMING.screenFade }}>
                <RewardScene reward={reward} />
                {result?.becameMastered && (
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="flex flex-col items-center rounded-[28px] bg-surface/90 p-4">
                      <Sticker label={lesson.title} animate calm={calm} size={180} />
                      <span className="font-semibold">{S.child.newSticker}</span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="a-controls flex flex-wrap items-stretch justify-center gap-[var(--gap)]">
          {stage === "watch" && plans && (
            <>
              <button className="child-btn" disabled={watchIndex === 0} aria-disabled={watchIndex === 0} onClick={() => (setSlideDone(false), setWatchIndex((i) => Math.max(0, i - 1)))}>
                <Icon name="back" />
                <span className="ctl-label">{S.child.back}</span>
              </button>
              <button className="child-btn" onClick={() => (setSlideDone(false), setWatchKey((k) => k + 1))}>
                <Icon name="replay" />
                <span className="ctl-label">{S.child.replay}</span>
              </button>
              <button className="child-btn primary" onClick={nextSlide}>
                <span className="ctl-label">{watchLast ? S.child.startPractise : S.child.next}</span>
                <Icon name="next" />
              </button>
            </>
          )}
          {stage === "reward" && (
            <button className="child-btn primary" onClick={() => (stopSpeech(), router.push("/"))}>
              <Icon name="check" />
              <span className="ctl-label">{S.child.finish}</span>
            </button>
          )}
        </div>
      </main>

      <AnimatePresence>
        {breakOpen && <BreakScreen key="break" onReady={closeBreak} onStop={stop} />}
        {boardFull && reward && (
          <motion.div
            key="full"
            role="dialog"
            aria-modal="true"
            aria-label={VOICE.boardFull}
            className="child fixed inset-0 z-30 flex flex-col gap-4 bg-page p-[max(16px,env(safe-area-inset-top))_16px_max(16px,env(safe-area-inset-bottom))]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: TIMING.screenFade }}
          >
            <ReadAlong text={VOICE.boardFull} className="text-center" />
            <div className="min-h-0 flex-1">
              <RewardScene reward={reward} />
            </div>
            <button autoFocus className="child-btn primary self-center" onClick={endBoardFull}>
              {S.child.keepGoing}
              <Icon name="next" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}
