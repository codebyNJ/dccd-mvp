import { describe, expect, it } from "vitest";
import { isIndependent, promptDelayMs, reduceTrial, startTrial, unpromptedErrors, type TrialState } from "@/lib/trial";
import { TEACHING } from "@/config/teaching";

const base = { itemId: "i1", correctSide: "left" as const };
const practise = (strategy: "errorless" | "least-to-most", delaySeconds = 0) =>
  startTrial({ ...base, step: "practise", strategy, delaySeconds }, 1000);

describe("trial state machine — errorless", () => {
  it("prompts at the current delay; 0 s means immediately after the instruction", () => {
    expect(promptDelayMs(practise("errorless", 0))).toBe(0);
    expect(promptDelayMs(practise("errorless", 3))).toBe(3000);
  });

  it("a correct tap before the prompt is independent", () => {
    let s = reduceTrial(practise("errorless", 2), { type: "ready" });
    s = reduceTrial(s, { type: "tap", side: "left", at: 2500 });
    expect(s.phase).toBe("correct");
    expect(s.records[0]).toMatchObject({ correct: true, promptLevel: 0, latencyMs: 1500 });
    expect(isIndependent(s.records[0])).toBe(true);
  });

  it("a correct tap after the prompt is recorded as prompted (level 3)", () => {
    let s = reduceTrial(practise("errorless", 0), { type: "ready" });
    s = reduceTrial(s, { type: "prompt" });
    expect(s.promptLevel).toBe(3);
    expect(promptDelayMs(s)).toBeNull();
    s = reduceTrial(s, { type: "tap", side: "left", at: 1800 });
    expect(isIndependent(s.records[0])).toBe(false);
  });

  it("error correction: wrong tap → retry → same trial at full prompt → prompted correct", () => {
    let s: TrialState = reduceTrial(practise("errorless", 3), { type: "ready" });
    s = reduceTrial(s, { type: "tap", side: "right", at: 1500 });
    expect(s.phase).toBe("retry");
    expect(unpromptedErrors(s.records)).toBe(1);
    s = reduceTrial(s, { type: "represent", at: 3000 });
    expect(s).toMatchObject({ phase: "presenting", promptLevel: 3, correction: true, correctSide: "left", itemId: "i1" });
    s = reduceTrial(s, { type: "tap", side: "left", at: 3600 });
    expect(s.phase).toBe("correct");
    expect(s.records[1]).toMatchObject({ correct: true, correction: true, promptLevel: 3, latencyMs: 600 });
    expect(isIndependent(s.records[1])).toBe(false);
  });

  it("errors after the prompt are not unprompted", () => {
    let s = reduceTrial(practise("errorless", 0), { type: "prompt" });
    s = reduceTrial(s, { type: "tap", side: "right", at: 1200 });
    expect(unpromptedErrors(s.records)).toBe(0);
  });
});

describe("trial state machine — least-to-most", () => {
  it("steps up one level per wait, up to level 3", () => {
    let s = reduceTrial(practise("least-to-most"), { type: "ready" });
    expect(promptDelayMs(s)).toBe(TEACHING.leastToMostWaitMs);
    s = reduceTrial(s, { type: "prompt" });
    expect(s.promptLevel).toBe(1);
    s = reduceTrial(s, { type: "prompt" });
    expect(s.promptLevel).toBe(2);
    s = reduceTrial(s, { type: "prompt" });
    expect(s.promptLevel).toBe(3);
    expect(promptDelayMs(s)).toBeNull();
    s = reduceTrial(s, { type: "tap", side: "left", at: 9000 });
    expect(s.records[0].promptLevel).toBe(3);
  });

  it("after an error re-presents at the full prompt (configurable default)", () => {
    let s = reduceTrial(practise("least-to-most"), { type: "tap", side: "right", at: 1100 });
    s = reduceTrial(s, { type: "represent", at: 2000 });
    expect(s.promptLevel).toBe(TEACHING.leastToMostErrorGoesToFullPrompt ? 3 : 1);
  });
});

describe("trial state machine — check and review", () => {
  it("never prompts; a wrong tap moves on without correction", () => {
    let s = startTrial({ ...base, step: "check", strategy: "errorless", delaySeconds: 0 }, 0);
    expect(promptDelayMs(s)).toBeNull();
    expect(reduceTrial(s, { type: "prompt" }).promptLevel).toBe(0);
    s = reduceTrial(s, { type: "tap", side: "right", at: 500 });
    expect(s.phase).toBe("moved-on");
    expect(reduceTrial(s, { type: "represent", at: 900 }).phase).toBe("moved-on");
  });

  it("ignores taps once the trial is over", () => {
    let s = startTrial({ ...base, step: "review", strategy: "errorless", delaySeconds: 0 }, 0);
    s = reduceTrial(s, { type: "tap", side: "left", at: 100 });
    s = reduceTrial(s, { type: "tap", side: "right", at: 200 });
    expect(s.records).toHaveLength(1);
  });
});
