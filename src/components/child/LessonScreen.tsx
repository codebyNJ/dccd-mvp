"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { S, SPEEDS, VOICE } from "@/config/strings";
import { TEACHING } from "@/config/teaching";
import { TIMING } from "@/config/timing";
import { characterSrc } from "@/data/characters";
import { newSeed, planTrials, rotate, stepSeed } from "@/lib/counterbalance";
import { teachableItems } from "@/lib/lessons";
import { lessonStatus } from "@/lib/progress";
import type { Item, Learner, Lesson, Polarity, Session, Side, TrialRecord, TrialStep } from "@/lib/schema";
import { correctCharacter, distractorCharacter, instructionLine, otherCharacter, praiseLine, teachLine } from "@/lib/templates";
import { tapOutcome, tapRecord, type TapOutcome } from "@/lib/trial";
import { preloadLines, speak, stopSpeech, type SpeakOptions } from "@/lib/voice";
import { useActiveLearner, useApp, type FinishResult } from "@/store/app";
import { CharacterCard } from "./CharacterCard";
import { GuideStar } from "./GuideStar";
import { ReadAlong } from "./ReadAlong";
import { RewardScene } from "./RewardScene";
import { RoughCircle } from "./RoughCircle";
import { Sticker } from "./Sticker";

interface Page {
  step: TrialStep;
  itemId: string;
  correctSide: Side;
}

export function LessonScreen() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const learner = useActiveLearner();
  const lessons = useApp((s) => s.lessons);
  const lesson = lessons.find((l) => l.id === id);

  let problem: string | null = null;
  if (!learner) problem = S.child.chooseLearnerFirst;
  else if (!lesson || !learner.assigned.includes(lesson.id)) problem = S.child.notAvailable;
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
  return <Book key={`${learner.id}:${lesson.id}`} learner={learner} lesson={lesson} />;
}

/**
 * A lesson as a storybook: a cover, one page per question, then "The end".
 * Everything moves on a tap: nothing is marked before the child chooses,
 * and the page only turns when the child taps the page corner.
 */
function Book({ learner, lesson }: { learner: Learner; lesson: Lesson }) {
  const router = useRouter();
  const muted = useApp((s) => s.muted);
  const setMuted = useApp((s) => s.setMuted);
  const updateSettings = useApp((s) => s.updateSettings);
  const saveSession = useApp((s) => s.saveSession);
  const finishSession = useApp((s) => s.finishSession);

  // Snapshot at the start: edits made mid-book never change a running session.
  const [items] = useState(() => teachableItems(lesson));
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [kind] = useState<Session["kind"]>(() => (lessonStatus(lesson, learner, Date.now()) === "review-due" ? "review" : "lesson"));

  const settings = learner.settings;
  const calm = settings.calmMode;
  const voice = useMemo<SpeakOptions>(() => ({ silent: muted || !settings.voiceOn, rate: settings.voiceRate }), [muted, settings.voiceOn, settings.voiceRate]);
  const voiceRef = useRef(voice);
  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  const [pages, setPages] = useState<Page[]>([]);
  /** -1 = cover, pages.length = the end. */
  const [at, setAt] = useState(-1);
  const [line, setLine] = useState("");
  const [result, setResult] = useState<FinishResult | null>(null);
  const session = useRef<Session | null>(null);

  const say = useCallback((text: string) => {
    setLine(text);
    return speak(text, voiceRef.current);
  }, []);

  const open = () => {
    const seed = newSeed();
    const ids = items.map((i) => i.id);
    const prior = useApp.getState().sessions.filter((x) => x.learnerId === learner.id && x.lessonId === lesson.id).length;
    const tag = (step: TrialStep) => (t: { itemId: string; correctSide: Side }) => ({ ...t, step });
    setPages(
      kind === "review"
        ? planTrials(rotate(ids, prior).slice(0, TEACHING.reviewTrials), stepSeed(seed, "review"), 0).map(tag("review"))
        : [
            ...planTrials(ids, stepSeed(seed, "practise"), prior).map(tag("practise")),
            ...planTrials(ids, stepSeed(seed, "check"), prior + Math.floor(ids.length / 2)).map(tag("check")),
          ],
    );
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
      delaySeconds: 0,
      reward: "stars",
      breaks: [],
      trials: [],
      summary: null,
    };
    saveSession({ ...session.current });
    preloadLines(items.flatMap((i) => [instructionLine(i, lesson.polarity), teachLine(i, lesson.polarity), praiseLine(i, lesson.polarity, correctCharacter(i, lesson.polarity))]).concat(Object.values(VOICE)));
    setAt(0);
  };

  const onRecord = (r: TrialRecord) => {
    if (!session.current) return;
    session.current = { ...session.current, trials: [...session.current.trials, r] };
    saveSession({ ...session.current });
  };

  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
      stopSpeech();
    },
    [],
  );

  const turn = () => {
    stopSpeech();
    const next = at + 1;
    if (next < pages.length) return setAt(next);
    const s = session.current;
    if (!s) return;
    session.current = { ...s, completed: true };
    const r = finishSession(session.current, { practiseCompleted: false });
    setResult(r);
    setAt(next);
    // The end: "The end. Great reading!", then the sticker line if one was earned.
    void say(VOICE.allDone).done.then(() => mounted.current && r.becameMastered && say(VOICE.newSticker));
  };

  const goHome = () => {
    stopSpeech();
    const s = session.current;
    if (s && s.endedAt === null && !s.completed) finishSession(s, { practiseCompleted: false });
    router.push("/");
  };

  const speedIndex = Math.max(0, SPEEDS.findIndex(([r]) => r >= settings.voiceRate - 0.01));
  const [, speedLabel] = SPEEDS[speedIndex];
  const cycleSpeed = () => {
    const [rate] = SPEEDS[(speedIndex + 1) % SPEEDS.length];
    updateSettings(learner.id, { voiceRate: rate });
    voiceRef.current = { ...voiceRef.current, rate };
    // Say the line again at the new speed, so the child hears the change.
    if (line) say(line);
  };

  const page = pages[at];
  const item = page ? itemMap.get(page.itemId) : undefined;
  const intro = at === 0 ? (kind === "review" ? VOICE.quiz : VOICE.openBook) : page?.step === "check" && pages[at - 1]?.step === "practise" ? VOICE.quiz : undefined;

  return (
    <main className={`child book-screen ${settings.textSize === "large" ? "text-large" : ""}`} aria-label={lesson.title}>
      <nav className="flex items-center justify-between gap-[var(--gap)]" aria-label={lesson.title}>
        <button className="child-btn" onClick={goHome} aria-label={S.child.home}>
          <Icon name="home" />
        </button>
        <div className="flex gap-[var(--gap)]">
          <button className="child-btn" onClick={cycleSpeed} aria-label={S.child.speed(speedLabel)} title={S.child.speed(speedLabel)} data-testid="speed">
            <Icon name={speedIndex === 0 ? "snail" : speedIndex === 2 ? "rabbit" : "walk"} className="!h-[1.4em] !w-[1.4em]" />
          </button>
          <button className="child-btn" aria-pressed={muted} aria-label={S.child.mute} onClick={() => setMuted(!muted)}>
            <Icon name={muted ? "soundOff" : "soundOn"} className="!h-[1.3em] !w-[1.3em]" />
          </button>
        </div>
      </nav>

      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={at}
          className="book-page"
          initial={{ opacity: 0, x: 48, rotateY: -10 }}
          animate={{ opacity: 1, x: 0, rotateY: 0, transition: { duration: TIMING.pageTurn, ease: [0.22, 1, 0.36, 1] } }}
          exit={{ opacity: 0, x: -48, rotateY: 10, transition: { duration: TIMING.pageTurn * 0.5, ease: "easeIn" } }}
          style={{ transformPerspective: 1400, transformOrigin: "left center" }}
        >
          {at < 0 && <Cover lesson={lesson} first={items[0]} onOpen={open} />}
          {page && item && (
            <StoryPage
              page={page}
              item={item}
              polarity={lesson.polarity}
              calm={calm}
              line={line}
              say={say}
              intro={intro}
              number={at + 1}
              total={pages.length}
              onRecord={onRecord}
              onTurn={turn}
            />
          )}
          {at >= 0 && at >= pages.length && (
            <div className="relative grid h-full grid-rows-[auto_minmax(0,1fr)_auto] gap-[var(--gap)]">
              <ReadAlong text={result?.becameMastered && line === VOICE.newSticker ? VOICE.newSticker : VOICE.allDone} className="text-center" />
              <div className="relative min-h-0">
                <RewardScene />
                <div className="absolute inset-0 grid place-items-center">
                  <div className="flex flex-col items-center gap-2 rounded-[28px] bg-paper/90 p-4">
                    <span className="book-title text-[1.6em]">{S.child.theEnd}</span>
                    {result?.becameMastered && (
                      <>
                        <Sticker label={lesson.title} animate calm={calm} size={160} />
                        <span className="font-semibold">{S.child.newSticker}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button className="child-btn primary self-center justify-self-center" onClick={() => (stopSpeech(), router.push("/"))}>
                <Icon name="home" />
                {S.child.finish}
              </button>
            </div>
          )}
        </motion.section>
      </AnimatePresence>
    </main>
  );
}

function Cover({ lesson, first, onOpen }: { lesson: Lesson; first: Item; onOpen: () => void }) {
  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] justify-items-center gap-[var(--gap)] text-center">
      <h1 className="book-title text-[1.6em]">{S.child.bookTitle(lesson.polarity)}</h1>
      <div className="flex min-h-0 w-full max-w-[720px] items-center justify-center gap-[var(--gap)]" aria-hidden>
        {[first.answer, otherCharacter(first)].map((c) => (
          // eslint-disable-next-line @next/next/no-img-element -- static export
          <img key={c} src={characterSrc(c)} alt="" className="illustration aspect-square h-full max-h-[40vh] min-w-0 max-w-[46%] p-[3%]" />
        ))}
      </div>
      <button autoFocus className="child-btn primary" onClick={onOpen}>
        <Icon name="book" />
        {S.child.openBook}
      </button>
    </div>
  );
}

type Phase = "asking" | TapOutcome;

interface PageProps {
  page: Page;
  item: Item;
  polarity: Polarity;
  calm: boolean;
  line: string;
  say: (text: string) => { done: Promise<void> };
  intro?: string;
  number: number;
  total: number;
  onRecord: (r: TrialRecord) => void;
  onTurn: () => void;
}

/**
 * One page: the question is read, the child taps a picture, then (and only
 * then) the circle draws around the answer. The page-turn arrow appears
 * once the narrator has finished.
 */
function StoryPage({ page, item, polarity, calm, line, say, intro, number, total, onRecord, onTurn }: PageProps) {
  const [phase, setPhase] = useState<Phase>("asking");
  const [canTurn, setCanTurn] = useState(false);
  const wrongs = useRef(0);
  const shownAt = useRef(0);
  const answered = useRef(false);
  const instruction = instructionLine(item, polarity);
  const answer = correctCharacter(item, polarity);
  const who = (side: Side) => (side === page.correctSide ? answer : distractorCharacter(item, polarity));

  useEffect(() => {
    let alive = true;
    shownAt.current = performance.now();
    void (async () => {
      if (intro) await say(intro).done;
      if (alive && !answered.current) say(instruction);
    })();
    // No stopSpeech here: the page unmounts after its exit animation, when the next line may already be playing.
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per page
  }, []);

  const tappable = phase === "asking" || phase === "again";

  const onTap = (side: Side) => {
    if (!tappable) return;
    answered.current = true;
    // Called only from a card's click handler.
    // eslint-disable-next-line react-hooks/purity
    const now = performance.now();
    const correct = side === page.correctSide;
    onRecord(tapRecord({ itemId: item.id, step: page.step, correctSide: page.correctSide }, side, wrongs.current, shownAt.current, now));
    const outcome = tapOutcome(page.step, wrongs.current, correct);
    if (!correct) wrongs.current += 1;
    shownAt.current = now;
    setPhase(outcome);
    const text =
      outcome === "right" ? praiseLine(item, polarity, who(side)) : outcome === "again" ? VOICE.lookAgain : outcome === "reveal" ? teachLine(item, polarity) : VOICE.tryAnother;
    const spoken = say(text);
    if (outcome !== "again") void spoken.done.then(() => setCanTurn(true));
  };

  const circled = phase === "right" || phase === "reveal";
  const tag = polarity === "cant" ? S.child.cantLabel : S.child.canLabel;

  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] gap-[var(--gap)]" data-page={number} data-step={page.step} data-question={instruction}>
      <div className="flex min-h-[1.3em] items-center gap-3">
        <button className="shrink-0 rounded-full" onClick={() => say(line || instruction)} aria-label={S.child.sayAgain} title={S.child.sayAgain}>
          <GuideStar calm={calm} size={64} />
        </button>
        <div className="min-w-0 flex-1" aria-hidden>
          <ReadAlong text={line || instruction} />
        </div>
      </div>

      <div className="cards">
        {(["left", "right"] as Side[]).map((side, i) => {
          const isAnswer = side === page.correctSide;
          return (
            <CharacterCard
              key={side}
              character={who(side)}
              index={i}
              state={circled ? (isAnswer ? "answer" : "dimmed") : "idle"}
              calm={calm}
              tappable={tappable}
              onTap={() => onTap(side)}
            >
              {isAnswer && (
                <>
                  <RoughCircle show={circled} calm={calm} color={polarity === "cant" ? "var(--coral-500)" : "var(--blue-500)"} />
                  {circled && (
                    <motion.span
                      className={`absolute -bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-[14px] border-2 px-3 py-0.5 font-semibold ${polarity === "cant" ? "border-coral-500 bg-coral-50 text-coral-ink" : "border-blue-300 bg-blue-50 text-blue-800"}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: calm ? 0 : TIMING.circleDraw * 0.6, duration: 0.4 } }}
                    >
                      {tag}
                    </motion.span>
                  )}
                </>
              )}
            </CharacterCard>
          );
        })}
      </div>

      <footer className="flex min-h-[var(--tap-child)] items-center justify-between gap-3">
        <span className="text-[0.6em] text-ink-muted" aria-label={S.child.page(number, total)}>
          {number} / {total}
        </span>
        <AnimatePresence>
          {canTurn && (
            <motion.button
              key="turn"
              className="child-btn primary page-corner"
              onClick={onTurn}
              aria-label={S.child.turnPage}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              autoFocus
            >
              <Icon name="next" className="!h-[1.4em] !w-[1.4em]" />
            </motion.button>
          )}
        </AnimatePresence>
      </footer>
    </div>
  );
}
