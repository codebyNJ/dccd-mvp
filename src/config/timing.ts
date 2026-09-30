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
  /** Card entrance stagger (Motion). */
  cardStagger: 0.12,
  /** Card feedback states: picked-correct, dimmed (Motion). */
  feedback: 0.6,
  /** The hand-drawn circle drawing itself around a picture (GSAP), seconds. */
  circleDraw: 0.9,
  /** Page turn (Motion), seconds. */
  pageTurn: 0.55,

  /** Idle loops (GSAP): slow sine yoyo, small amplitude. */
  idle: { minSeconds: 3, maxSeconds: 5, ease: "sine.inOut" },
} as const;

/**
 * Test hook: Playwright sets window.__DCCD_TIME_SCALE__ to run trials fast.
 * It scales waits (silent narration), never shown to users.
 */
export function timeScale(): number {
  if (typeof window === "undefined") return 1;
  const s = (window as Window & { __DCCD_TIME_SCALE__?: number }).__DCCD_TIME_SCALE__;
  return typeof s === "number" && s > 0 ? s : 1;
}
