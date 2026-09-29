import { describe, expect, it } from "vitest";
import { planTrials, rotate, sideSequence } from "@/lib/counterbalance";
import type { Side } from "@/lib/schema";

const maxRun = (s: Side[]) => {
  let best = 1;
  let run = 1;
  for (let i = 1; i < s.length; i++) {
    run = s[i] === s[i - 1] ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
};

describe("counterbalancing", () => {
  it("puts the answer 5 times on each side per 10-trial block, never more than 2 in a row", () => {
    for (let seed = 0; seed < 500; seed++) {
      const s = sideSequence(10, seed);
      expect(s.filter((x) => x === "left")).toHaveLength(5);
      expect(s.filter((x) => x === "right")).toHaveLength(5);
      expect(maxRun(s)).toBeLessThanOrEqual(2);
    }
  });

  it("keeps runs ≤ 2 across block boundaries and balances every block", () => {
    for (let seed = 0; seed < 200; seed++) {
      const s = sideSequence(30, seed);
      expect(maxRun(s)).toBeLessThanOrEqual(2);
      for (let b = 0; b < 3; b++) expect(s.slice(b * 10, b * 10 + 10).filter((x) => x === "left")).toHaveLength(5);
    }
  });

  it("is deterministic for a seed and varies across seeds", () => {
    expect(sideSequence(10, 42)).toEqual(sideSequence(10, 42));
    const distinct = new Set(Array.from({ length: 20 }, (_, i) => sideSequence(10, i).join()));
    expect(distinct.size).toBeGreaterThan(5);
  });

  it("splits odd blocks as evenly as possible (5-trial review: 3/2)", () => {
    for (let seed = 0; seed < 100; seed++) {
      const left = sideSequence(5, seed).filter((x) => x === "left").length;
      expect([2, 3]).toContain(left);
    }
  });

  it("rotates the item order between sessions", () => {
    expect(rotate([1, 2, 3, 4], 1)).toEqual([2, 3, 4, 1]);
    expect(rotate([1, 2, 3, 4], 5)).toEqual([2, 3, 4, 1]);
    const ids = ["a", "b", "c"];
    expect(planTrials(ids, 1, 0)[0].itemId).toBe("a");
    expect(planTrials(ids, 1, 1)[0].itemId).toBe("b");
  });
});
