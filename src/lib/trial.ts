import type { Side, TrialRecord, TrialStep } from "./schema";

/**
 * What a tap on a storybook page means. Nothing is marked before the tap:
 *  - right → the circle draws around the picture and the narrator praises
 *  - learn pages ("practise"): first wrong → "Let's look again"; second wrong → show the answer
 *  - quiz pages ("check" / "review"): wrong → "Let's try another" and the page can turn
 */
export type TapOutcome = "right" | "again" | "reveal" | "next";

export function tapOutcome(step: TrialStep, wrongsBefore: number, correct: boolean): TapOutcome {
  if (correct) return "right";
  if (step === "check" || step === "review") return "next";
  return wrongsBefore === 0 ? "again" : "reveal";
}

/** A tap as recorded for the progress reports. A tap after an earlier wrong one is a correction. */
export function tapRecord(
  t: { itemId: string; step: TrialStep; correctSide: Side },
  side: Side,
  wrongsBefore: number,
  shownAt: number,
  at: number,
): TrialRecord {
  return {
    ...t,
    tappedSide: side,
    correct: side === t.correctSide,
    promptLevel: 0,
    correction: wrongsBefore > 0,
    latencyMs: Math.max(0, Math.round(at - shownAt)),
    at,
  };
}

/** A correct answer is independent only with no prompt and no earlier error on this trial. */
export function isIndependent(r: TrialRecord): boolean {
  return r.correct && r.promptLevel === 0 && !r.correction;
}

/** Errors made before any prompt appeared (drives the time-delay steps). */
export const unpromptedErrors = (records: TrialRecord[]) =>
  records.filter((r) => !r.correct && r.promptLevel === 0 && !r.correction).length;
