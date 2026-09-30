import { describe, expect, it } from "vitest";
import { positionBias } from "@/lib/bias";
import { instructionLine, praiseLine, teachLine, correctCharacter, distractorCharacter } from "@/lib/templates";
import { deckItems, defaultLessons } from "@/lib/lessons";
import type { Side, TrialRecord } from "@/lib/schema";
import { makeDemoData } from "@/lib/demo";
import { plainSummary } from "@/lib/summary";

const rec = (over: Partial<TrialRecord>): TrialRecord => ({
  itemId: "i",
  step: "practise",
  correctSide: "left",
  tappedSide: "left",
  correct: true,
  promptLevel: 0,
  correction: false,
  latencyMs: 1000,
  at: 0,
  ...over,
});

describe("position bias", () => {
  const taps = (sides: Side[]) => sides.map((s, i) => rec({ tappedSide: s, at: i }));

  it("flags a side above 70% over the last 20 taps", () => {
    const r = positionBias(taps([...Array(15).fill("right"), ...Array(5).fill("left")] as Side[]));
    expect(r).toMatchObject({ n: 20, flagged: true, side: "right" });
    expect(r.right).toBeCloseTo(0.75);
  });

  it("does not flag exactly 70% or balanced taps", () => {
    expect(positionBias(taps([...Array(14).fill("left"), ...Array(6).fill("right")] as Side[])).flagged).toBe(false);
    expect(positionBias(taps(Array.from({ length: 20 }, (_, i) => (i % 2 ? "left" : "right")))).flagged).toBe(false);
  });

  it("counts each trial's first tap, not taps after an error-correction prompt", () => {
    const first = taps(Array(20).fill("right") as Side[]);
    const corrections = first.map((r) => ({ ...r, tappedSide: "left" as Side, correction: true, at: r.at + 0.5 }));
    expect(positionBias([...first, ...corrections])).toMatchObject({ n: 20, flagged: true, side: "right" });
  });

  it("uses only the most recent 20 and needs 20 to flag", () => {
    const old = Array(30).fill("left") as Side[];
    const recent = Array.from({ length: 20 }, (_, i): Side => (i % 2 ? "left" : "right"));
    expect(positionBias(taps([...old, ...recent])).flagged).toBe(false);
    expect(positionBias(taps(Array(10).fill("right") as Side[])).flagged).toBe(false);
  });
});

describe("templates", () => {
  const swim = deckItems()[0];
  it("renders instruction, teach and praise lines for both polarities", () => {
    expect(instructionLine(swim, "cant")).toBe("Who can’t swim?");
    expect(instructionLine(swim, "can")).toBe("Who can swim?");
    expect(teachLine(swim, "cant")).toBe("The baby can’t swim. The swimmer can swim.");
    expect(teachLine(swim, "can")).toBe("The swimmer can swim. The baby can’t swim.");
    expect(praiseLine(swim, "cant", "baby")).toBe("Yes! The baby can’t swim.");
    expect(praiseLine(swim, "can", "swimmer")).toBe("Yes! The swimmer can swim.");
  });

  it("the correct pick in a Can lesson is the other character", () => {
    expect(correctCharacter(swim, "cant")).toBe("baby");
    expect(correctCharacter(swim, "can")).toBe("swimmer");
    // The two cards in a trial are always different characters.
    expect(distractorCharacter(swim, "can")).toBe("baby");
    expect(distractorCharacter(swim, "cant")).toBe("swimmer");
    const bark = deckItems()[3];
    expect(praiseLine(bark, "cant", correctCharacter(bark, "cant"))).toBe("Yes! The cat can’t bark.");
  });
});

describe("demo data and plain summary", () => {
  const lessons = defaultLessons();
  const now = Date.UTC(2026, 8, 29);
  const demo = makeDemoData(lessons, now);

  it("is deterministic", () => {
    expect(makeDemoData(lessons, now)).toEqual(demo);
  });

  it("gives Kabir a flagged right-side bias and Asha none", () => {
    const trialsOf = (id: string) => demo.sessions.filter((s) => s.learnerId === id).flatMap((s) => s.trials);
    expect(positionBias(trialsOf("demo-kabir"))).toMatchObject({ flagged: true, side: "right" });
    expect(positionBias(trialsOf("demo-asha")).flagged).toBe(false);
  });

  it("Asha has mastered Can (sticker) and is strong on the lion questions in Can't", () => {
    const asha = demo.learners.find((l) => l.id === "demo-asha")!;
    expect(asha.progress.can.everMastered).toBe(true);
    expect(asha.stickers).toContain("can");
    const cant = lessons[1];
    const text = plainSummary(cant, demo.sessions.filter((s) => s.learnerId === "demo-asha" && s.lessonId === "cant"));
    expect(text).toMatch(/lion questions/);
    expect(text).toMatch(/who can’t roar/);
  });

  it("Kabir has not mastered Can", () => {
    const kabir = demo.learners.find((l) => l.id === "demo-kabir")!;
    expect(kabir.progress.can.everMastered).toBe(false);
  });
});
