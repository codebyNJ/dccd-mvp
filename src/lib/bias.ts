import { TEACHING } from "@/config/teaching";
import type { Side, TrialRecord } from "./schema";

export interface BiasResult {
  n: number;
  left: number;
  right: number;
  flagged: boolean;
  side: Side | null;
}

/**
 * Share of taps on each side over the last `window` trials (first tap of each
 * trial; taps after an error-correction prompt show the prompt, not the child's
 * preference). Flagged when either side exceeds the threshold over a full window.
 */
export function positionBias(
  records: TrialRecord[],
  window: number = TEACHING.biasWindow,
  threshold: number = TEACHING.biasThreshold,
): BiasResult {
  const recent = records.filter((r) => !r.correction).sort((a, b) => a.at - b.at).slice(-window);
  const n = recent.length;
  if (n === 0) return { n, left: 0, right: 0, flagged: false, side: null };
  const left = recent.filter((r) => r.tappedSide === "left").length / n;
  const right = 1 - left;
  const side: Side | null = left > threshold ? "left" : right > threshold ? "right" : null;
  return { n, left, right, flagged: side !== null && n >= window, side };
}
