import { TEACHING } from "@/config/teaching";
import type { Session, SessionSummary } from "./schema";
import { isIndependent, unpromptedErrors } from "./trial";

export function summarize(s: Pick<Session, "trials" | "breaks">, now: number): SessionSummary {
  const t = s.trials;
  const probe = t.filter((r) => r.step === "check" || r.step === "review");
  const promptCounts: SessionSummary["promptCounts"] = [0, 0, 0, 0];
  for (const r of t) promptCounts[r.promptLevel] += 1;
  const lat = t.map((r) => r.latencyMs);
  return {
    checkTotal: probe.length,
    checkIndependentCorrect: probe.filter(isIndependent).length,
    promptCounts,
    meanLatencyMs: lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : null,
    unpromptedErrors: unpromptedErrors(t.filter((r) => r.step === "practise")),
    breakCount: s.breaks.length,
    breakMs: s.breaks.reduce((a, b) => a + ((b.end ?? now) - b.start), 0),
    taps: {
      left: t.filter((r) => r.tappedSide === "left").length,
      right: t.filter((r) => r.tappedSide === "right").length,
    },
  };
}

/** Keep trial-level data for the most recent N sessions per learner + lesson; older ones keep their summary only. */
export function trimHistory(sessions: Session[], keep: number = TEACHING.trialHistorySessions): Session[] {
  const seen = new Map<string, number>();
  const newestFirst = [...sessions].sort((a, b) => b.startedAt - a.startedAt);
  const drop = new Set<string>();
  for (const s of newestFirst) {
    const k = `${s.learnerId}:${s.lessonId}`;
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    if (n > keep && s.trials.length > 0) drop.add(s.id);
  }
  if (drop.size === 0) return sessions;
  return sessions.map((s) =>
    drop.has(s.id) ? { ...s, summary: s.summary ?? summarize(s, s.endedAt ?? s.startedAt), trials: [] } : s,
  );
}

/** Close sessions left open by a closed tab, so their data still counts. */
export function closeDangling(sessions: Session[]): Session[] {
  return sessions.map((s) => {
    if (s.endedAt !== null) return s;
    const end = Math.max(s.startedAt, ...s.trials.map((t) => t.at), ...s.breaks.map((b) => b.end ?? b.start));
    const breaks = s.breaks.map((b) => (b.end === null ? { ...b, end } : b));
    return { ...s, endedAt: end, breaks, summary: summarize({ trials: s.trials, breaks }, end) };
  });
}
