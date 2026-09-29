import type { TrialRecord } from "./schema";
import { isIndependent } from "./trial";

/** Independent correct answers always earn a token; prompted ones only if the learner's setting allows. */
export function earnsToken(r: TrialRecord, tokensForPrompted: boolean): boolean {
  if (!r.correct) return false;
  return isIndependent(r) || tokensForPrompted;
}

/** Add a token. When the board fills, the reward plays and the board starts again from empty. */
export function addToken(filled: number, size: number): { filled: number; full: boolean } {
  const next = Math.min(size, filled + 1);
  return { filled: next, full: next >= size };
}
