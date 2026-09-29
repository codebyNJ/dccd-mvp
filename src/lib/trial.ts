import { TEACHING } from "@/config/teaching";
import type { PromptLevel, Side, Strategy, TrialRecord, TrialStep } from "./schema";

/**
 * One teaching trial as a pure state machine. The lesson runner performs the
 * side effects (speaking, timers, animation) and feeds events back in:
 *
 *   presenting ──ready──▶ awaiting ──tap✓──▶ correct
 *        │                  │  ▲
 *        │                prompt (timer: time delay or least-to-most wait)
 *        └──────tap✗───────▶ retry ──represent──▶ presenting (full prompt)   [practise]
 *                           moved-on                                        [check / review]
 */
export type Phase = "presenting" | "awaiting" | "correct" | "retry" | "moved-on";

export interface TrialState {
  step: TrialStep;
  strategy: Strategy;
  delaySeconds: number;
  itemId: string;
  correctSide: Side;
  phase: Phase;
  /** Prompt currently shown: 0 none, 1 instruction repeated, 2 + glow, 3 + guide points and card grows. */
  promptLevel: PromptLevel;
  correction: boolean;
  /** When the cards became tappable (latency is measured from here). */
  shownAt: number;
  records: TrialRecord[];
}

export type TrialEvent =
  | { type: "ready" }
  | { type: "prompt" }
  | { type: "tap"; side: Side; at: number }
  | { type: "represent"; at: number };

export const usesPrompts = (step: TrialStep) => step === "practise" || step === "missed";

export function startTrial(
  opts: { step: TrialStep; strategy: Strategy; delaySeconds: number; itemId: string; correctSide: Side },
  at: number,
): TrialState {
  return { ...opts, phase: "presenting", promptLevel: 0, correction: false, shownAt: at, records: [] };
}

/** ms after the instruction ends before the next prompt step, or null for none. */
export function promptDelayMs(s: TrialState): number | null {
  if (!usesPrompts(s.step) || s.promptLevel === 3) return null;
  if (s.phase !== "presenting" && s.phase !== "awaiting") return null;
  if (s.strategy === "errorless") return s.delaySeconds * 1000;
  return TEACHING.leastToMostWaitMs;
}

const up = (l: PromptLevel): PromptLevel => Math.min(3, l + 1) as PromptLevel;

export function reduceTrial(s: TrialState, e: TrialEvent): TrialState {
  switch (e.type) {
    case "ready":
      return s.phase === "presenting" ? { ...s, phase: "awaiting" } : s;

    case "prompt":
      if (!usesPrompts(s.step) || (s.phase !== "presenting" && s.phase !== "awaiting")) return s;
      return { ...s, promptLevel: s.strategy === "errorless" ? 3 : up(s.promptLevel) };

    case "tap": {
      if (s.phase !== "presenting" && s.phase !== "awaiting") return s;
      const correct = e.side === s.correctSide;
      const record: TrialRecord = {
        itemId: s.itemId,
        step: s.step,
        correctSide: s.correctSide,
        tappedSide: e.side,
        correct,
        promptLevel: s.promptLevel,
        correction: s.correction,
        latencyMs: Math.max(0, Math.round(e.at - s.shownAt)),
        at: e.at,
      };
      const phase: Phase = correct ? "correct" : usesPrompts(s.step) ? "retry" : "moved-on";
      return { ...s, phase, records: [...s.records, record] };
    }

    case "represent": {
      if (s.phase !== "retry") return s;
      const full = s.strategy === "errorless" || TEACHING.leastToMostErrorGoesToFullPrompt;
      return { ...s, phase: "presenting", correction: true, promptLevel: full ? 3 : up(s.promptLevel), shownAt: e.at };
    }
  }
}

/** A correct answer is independent only with no prompt and no earlier error on this trial. */
export function isIndependent(r: TrialRecord): boolean {
  return r.correct && r.promptLevel === 0 && !r.correction;
}

/** Errors made before any prompt appeared (drives the time-delay steps). */
export const unpromptedErrors = (records: TrialRecord[]) =>
  records.filter((r) => !r.correct && r.promptLevel === 0 && !r.correction).length;
