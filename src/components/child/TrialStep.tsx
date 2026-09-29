"use client";

import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { VOICE } from "@/config/strings";
import { TIMING, timeScale } from "@/config/timing";
import type { PlannedTrial } from "@/lib/counterbalance";
import type { Item, Polarity, Side, Strategy, TrialRecord, TrialStep as StepName } from "@/lib/schema";
import { correctCharacter, distractorCharacter, instructionLine, praiseLine } from "@/lib/templates";
import { promptDelayMs, reduceTrial, startTrial, usesPrompts, type TrialEvent, type TrialState } from "@/lib/trial";
import { speak, stopSpeech, type SpeakOptions } from "@/lib/voice";
import { CharacterCard, type CardState } from "./CharacterCard";
import { GuideStar } from "./GuideStar";
import { ReadAlong } from "./ReadAlong";

const CANCEL = Symbol("cancel");
type Ev = { kind: "tap"; side: Side; at: number } | { kind: "timer" } | { kind: "spoken" };

interface Props {
  step: StepName;
  plan: PlannedTrial[];
  items: Map<string, Item>;
  polarity: Polarity;
  strategy: Strategy;
  delaySeconds: number;
  pauseMs: number;
  calm: boolean;
  voice: SpeakOptions;
  /** A break is open: stop everything; the current trial is shown again after Ready. */
  paused: boolean;
  /** Spoken once before the first trial (the schedule line). */
  intro?: string;
  /** Token currently flying out of a card. */
  flyingToken: { side: Side; slot: number } | null;
  onRecord: (r: TrialRecord) => void;
  /** Token + board-full reward; resolves when the lesson may continue. */
  onCorrect: (r: TrialRecord) => Promise<void>;
  onDone: () => void;
}

/**
 * Runs one step's trials. Each trial: attention ("Look") → instruction with
 * read-along → prompt per strategy → response → consequence → inter-trial
 * pause. The pure state machine in lib/trial.ts decides what each event means;
 * this component only performs the effects.
 */
export function TrialStep(p: Props) {
  const [index, setIndex] = useState(0);
  const [trial, setTrial] = useState<TrialState | null>(null);
  const [cardsOn, setCardsOn] = useState(false);
  const [tappable, setTappable] = useState(false);
  const [picked, setPicked] = useState<Side | null>(null);
  const [line, setLine] = useState("");

  const saved = useRef<{ index: number; st: TrialState } | null>(null);
  const emit = useRef<((e: Ev) => void) | null>(null);
  const introDone = useRef(!p.intro);
  const props = useRef(p);
  useEffect(() => {
    props.current = p;
  });

  const planned = p.plan[index];
  const item = planned ? p.items.get(planned.itemId) : undefined;

  useEffect(() => {
    if (p.paused) return;
    const P = props.current;
    const planned = P.plan[index];
    if (!planned) {
      P.onDone();
      return;
    }
    const item = P.items.get(planned.itemId)!;
    const instruction = instructionLine(item, P.polarity);

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const guard = <T,>(v: T): T => {
      if (cancelled) throw CANCEL;
      return v;
    };
    const wait = (ms: number) => new Promise<void>((res) => timers.push(setTimeout(res, ms * timeScale()))).then(guard);
    const say = (text: string) => {
      setLine(text);
      return speak(text, P.voice);
    };
    /** Resolve with the first of: a tap, the timer, or the line finishing. Each wait owns its own resolver. */
    const next = (opts: { timerMs?: number | null; spoken?: Promise<void> }) =>
      new Promise<Ev>((resolve) => {
        let open = true;
        let t: ReturnType<typeof setTimeout> | undefined;
        const fire = (e: Ev) => {
          if (!open) return;
          open = false;
          clearTimeout(t);
          if (emit.current === fire) emit.current = null;
          resolve(e);
        };
        emit.current = fire;
        if (opts.timerMs !== undefined && opts.timerMs !== null) {
          t = setTimeout(() => fire({ kind: "timer" }), opts.timerMs * timeScale());
          timers.push(t);
        }
        void opts.spoken?.then(() => fire({ kind: "spoken" }));
      }).then(guard);

    let st: TrialState;
    const commit = (e: TrialEvent) => {
      st = reduceTrial(st, e);
      saved.current = { index, st };
      setTrial(st);
    };

    async function present() {
      setCardsOn(true);
      setTappable(false);
      if (!introDone.current && P.intro) {
        await say(P.intro).done.then(guard);
        introDone.current = true;
      }
      if (!st.correction) {
        // Attention: the cards settle and the guide says "Look."
        await Promise.all([say(VOICE.look).done, wait(TIMING.attentionMs)]).then(guard);
      }
      // Instruction: the same wording every time, with read-along.
      st = { ...st, shownAt: performance.now() };
      saved.current = { index, st };
      setTrial(st);
      setPicked(null);
      setTappable(true);
      let ev = await next({ spoken: say(instruction).done });
      if (ev.kind === "spoken") {
        commit({ type: "ready" });
        if (st.promptLevel === 3 && st.strategy === "errorless" && usesPrompts(st.step)) {
          ev = await next({ spoken: say(VOICE.thisOne).done });
        }
      }
      while (ev.kind !== "tap") {
        ev = await next({ timerMs: promptDelayMs(st) });
        if (ev.kind === "timer") {
          commit({ type: "prompt" });
          // Prompt: errorless = glow + point + "This one"; least-to-most steps up one level.
          if (st.strategy === "errorless") ev = await next({ spoken: say(VOICE.thisOne).done });
          else if (st.promptLevel === 1) ev = await next({ spoken: say(instruction).done });
        }
      }
      return respond(ev);
    }

    async function respond(ev: Extract<Ev, { kind: "tap" }>): Promise<void> {
      commit({ type: "tap", side: ev.side, at: ev.at });
      setTappable(false);
      setPicked(ev.side);
      stopSpeech();
      const record = st.records[st.records.length - 1];
      P.onRecord(record);

      if (st.phase === "correct") {
        const picked = ev.side === planned.correctSide ? correctCharacter(item, P.polarity) : distractorCharacter(item, P.polarity);
        const praise = say(praiseLine(item, P.polarity, picked));
        await Promise.all([praise.done, P.onCorrect(record)]).then(guard);
      } else if (st.phase === "retry") {
        // Error correction: neutral words, no red, no shake, no sound effect.
        await say(VOICE.tryAgain).done.then(guard);
        await wait(TIMING.retryGapMs);
        commit({ type: "represent", at: performance.now() });
        return present();
      } else {
        await say(VOICE.tryAnother).done.then(guard);
      }
      // Inter-trial pause: the cards leave, the layout stays.
      setCardsOn(false);
      setLine("");
      await wait(P.pauseMs);
      setIndex((i) => i + 1);
    }

    const prev = saved.current?.index === index ? saved.current.st : null;
    if (prev && (prev.phase === "correct" || prev.phase === "moved-on")) {
      // A break came during feedback: move on.
      setCardsOn(false);
      void wait(P.pauseMs / 2).then(() => setIndex((i) => i + 1), () => undefined);
    } else {
      const now = performance.now();
      st = prev
        ? prev.phase === "retry"
          ? reduceTrial(prev, { type: "represent", at: now })
          : { ...prev, phase: "presenting" }
        : startTrial({ step: P.step, strategy: P.strategy, delaySeconds: P.delaySeconds, itemId: planned.itemId, correctSide: planned.correctSide }, now);
      saved.current = { index, st };
      setTrial(st);
      present().catch((e) => {
        if (e !== CANCEL) throw e;
      });
    }

    return () => {
      cancelled = true;
      emit.current = null;
      timers.forEach(clearTimeout);
      stopSpeech();
    };
  }, [index, p.paused]);

  // Called only from a card's click handler.
  // eslint-disable-next-line react-hooks/purity
  const onTap = (side: Side) => emit.current?.({ kind: "tap", side, at: performance.now() });

  const stateFor = (side: Side): CardState => {
    if (!trial || !planned) return "idle";
    if (picked) {
      if (trial.phase === "correct") return side === picked ? "picked-correct" : "dimmed";
      if (side === picked) return "picked-wrong";
    }
    if (side === planned.correctSide && usesPrompts(trial.step) && (trial.phase === "presenting" || trial.phase === "awaiting")) {
      if (trial.promptLevel === 3) return "prompted";
      if (trial.promptLevel === 2) return "glow";
    }
    return "idle";
  };

  const full = trial?.promptLevel === 3 && usesPrompts(trial.step) && (trial.phase === "presenting" || trial.phase === "awaiting");
  const who = (side: Side) =>
    item && planned ? (side === planned.correctSide ? correctCharacter(item, p.polarity) : distractorCharacter(item, p.polarity)) : null;

  return (
    <>
      <div className="a-prompt flex min-h-[1.3em] items-center gap-3">
        <GuideStar lean={full && planned ? planned.correctSide : null} calm={p.calm} size={64} />
        <div className="min-w-0 flex-1" aria-hidden>
          {line && <ReadAlong text={line} />}
        </div>
      </div>
      <div className="a-cards">
        <div className="cards">
          <AnimatePresence mode="popLayout">
            {cardsOn &&
              planned &&
              (["left", "right"] as Side[]).map((side, i) => {
                const c = who(side);
                return (
                  c && (
                    <CharacterCard
                      key={`${index}-${side}`}
                      character={c}
                      index={i}
                      state={stateFor(side)}
                      calm={p.calm}
                      tappable={tappable}
                      // eslint-disable-next-line react-hooks/refs -- click handler, not render
                      onTap={() => onTap(side)}
                      showHand={full && side === planned.correctSide}
                      tokenSlot={p.flyingToken?.side === side ? p.flyingToken.slot : null}
                    />
                  )
                );
              })}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
