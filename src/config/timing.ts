/**
 * All animation durations, eases and springs. One thing moves at a time;
 * feedback animations stay between 400 and 900 ms; nothing overshoots.
 */
export const SPRING = { type: "spring", bounce: 0, visualDuration: 0.5 } as const;
export const SPRING_QUICK = { type: "spring", bounce: 0, visualDuration: 0.4 } as const;

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const TIMING = {
  /** Screen and step transitions (Motion). */
  screenFade: 0.35,
  /** Trial card entrance stagger (Motion). */
  cardStagger: 0.12,
  /** Card feedback states: picked-correct, picked-wrong, dimmed (Motion). */
  feedback: 0.6,
  /** Prompt glow fade-in (never pulses). */
  promptGlow: 0.6,
  promptGrowScale: 1.05,
  /** Token flying into the board (shared layoutId). */
  tokenFly: 0.7,
  /** "Look" attention beat before the instruction, ms. */
  attentionMs: 900,
  /** Wait after "Let's try again" before re-presenting, ms. */
  retryGapMs: 400,

  /** Watch step (GSAP), seconds on the narration clock. */
  watch: {
    leadIn: 0.6,
    glideIn: 0.8,
    glideDistance: 48,
    circleDraw: 0.9,
    labelFade: 0.45,
    ease: "power2.out",
  },

  /** Idle loops (GSAP): slow sine yoyo, small amplitude. */
  idle: { minSeconds: 3, maxSeconds: 5, ease: "sine.inOut" },

  /** Reward animations (Motion), seconds. */
  reward: { length: 7, itemRise: 6 },

  /** Hold-to-open lock for the grown-up area, ms. */
  lockHoldMs: 2000,
} as const;

/**
 * Test hook: Playwright sets window.__DCCD_TIME_SCALE__ to run trials fast.
 * It scales waits (pauses, prompt delays, silent narration), never shown to users.
 */
export function timeScale(): number {
  if (typeof window === "undefined") return 1;
  const s = (window as Window & { __DCCD_TIME_SCALE__?: number }).__DCCD_TIME_SCALE__;
  return typeof s === "number" && s > 0 ? s : 1;
}
