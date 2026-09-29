import { TEACHING } from "@/config/teaching";
import type { Side } from "./schema";

/** Small deterministic PRNG (mulberry32). Same seed → same sequence. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const newSeed = () => Math.floor(Math.random() * 2 ** 31);

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Longest run of the same side, counting on from the previous block's tail. */
function runOk(seq: Side[], prev: Side[], max: number): boolean {
  const all = [...prev.slice(-max), ...seq];
  let run = 1;
  for (let i = 1; i < all.length; i++) {
    run = all[i] === all[i - 1] ? run + 1 : 1;
    if (run > max) return false;
  }
  return true;
}

/**
 * Sides for a whole sequence of n trials: balanced within each block
 * (5 left / 5 right per 10; odd blocks get the extra on a seeded side),
 * never more than `maxRun` in a row, deterministic for a seed.
 */
export function sideSequence(
  n: number,
  seed: number,
  blockSize: number = TEACHING.blockSize,
  maxRun: number = TEACHING.maxSameSideRun,
): Side[] {
  const rng = mulberry32(seed);
  const out: Side[] = [];
  for (let start = 0; start < n; start += blockSize) {
    const size = Math.min(blockSize, n - start);
    const extraLeft = rng() < 0.5;
    const left = Math.floor(size / 2) + (size % 2 && extraLeft ? 1 : 0);
    const base: Side[] = [...Array(left).fill("left"), ...Array(size - left).fill("right")];
    let block: Side[] | null = null;
    for (let tries = 0; tries < 500 && !block; tries++) {
      const cand = shuffle(base, rng);
      if (runOk(cand, out, maxRun)) block = cand;
    }
    // ponytail: rejection sampling; 500 tries never fails for blocks ≤ 10, the alternating fallback is belt and braces.
    out.push(...(block ?? base.map((_, i) => (i % 2 === 0 ? "left" : "right") as Side)));
  }
  return out;
}

/** Item order rotated between sessions: session k starts k items further along. */
export function rotate<T>(arr: T[], by: number): T[] {
  if (arr.length === 0) return arr;
  const k = ((by % arr.length) + arr.length) % arr.length;
  return [...arr.slice(k), ...arr.slice(0, k)];
}

export interface PlannedTrial {
  itemId: string;
  correctSide: Side;
}

/** Plan one step's trials: rotated order + counterbalanced sides from the seed. */
export function planTrials(itemIds: string[], seed: number, rotation: number): PlannedTrial[] {
  const order = rotate(itemIds, rotation);
  const sides = sideSequence(order.length, seed);
  return order.map((itemId, i) => ({ itemId, correctSide: sides[i] }));
}

/** Distinct, deterministic sub-seeds for each step of a session. */
export const stepSeed = (seed: number, step: "watch" | "practise" | "check" | "review" | "missed") =>
  (seed ^ { watch: 0x1f, practise: 0x2e3, check: 0x4d5c, review: 0x6b7a, missed: 0x7e8f }[step]) >>> 0;
