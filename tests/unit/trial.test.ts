import { describe, expect, it } from "vitest";
import { isIndependent, tapOutcome, tapRecord } from "@/lib/trial";

const t = { itemId: "i1", correctSide: "left" as const };

describe("storybook taps", () => {
  it("learn pages: right, then look again, then show the answer", () => {
    expect(tapOutcome("practise", 0, true)).toBe("right");
    expect(tapOutcome("practise", 0, false)).toBe("again");
    expect(tapOutcome("practise", 1, false)).toBe("reveal");
    expect(tapOutcome("practise", 1, true)).toBe("right");
  });

  it("quiz pages never retry: a wrong tap moves on", () => {
    expect(tapOutcome("check", 0, false)).toBe("next");
    expect(tapOutcome("review", 0, false)).toBe("next");
    expect(tapOutcome("check", 0, true)).toBe("right");
  });

  it("a first right tap is independent; a right tap after a wrong one is a correction", () => {
    const first = tapRecord({ ...t, step: "check" }, "left", 0, 1000, 2500);
    expect(first).toMatchObject({ correct: true, promptLevel: 0, correction: false, latencyMs: 1500 });
    expect(isIndependent(first)).toBe(true);
    const second = tapRecord({ ...t, step: "practise" }, "left", 1, 1000, 1200);
    expect(second.correction).toBe(true);
    expect(isIndependent(second)).toBe(false);
    expect(tapRecord({ ...t, step: "practise" }, "right", 0, 1000, 900)).toMatchObject({ correct: false, latencyMs: 0 });
  });
});
