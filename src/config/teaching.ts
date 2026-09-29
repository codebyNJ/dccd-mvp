/**
 * TEACHING DEFAULTS — starting points for DCCD's clinicians to review.
 *
 * Every threshold and delay the lessons use lives in this file. Per-learner
 * values (strategy, token board size, mastery criterion, pause, review
 * interval, unlock order) start from these defaults and are then changed in
 * the grown-up area. Nothing else in the app hard-codes a teaching number.
 */
export const TEACHING = {
  /** Errorless teaching: progressive time delay, in seconds, from first step to last. */
  timeDelaySteps: [0, 2, 3, 5],
  /** Move up one delay step after this many consecutive sessions… */
  timeDelayStepUpSessions: 2,
  /** …each with at most this many unprompted errors (errors before the prompt appeared). */
  timeDelayStepUpMaxErrors: 1,
  /** Move back down one step after a session with this many unprompted errors or more. */
  timeDelayStepDownErrors: 3,

  /** Least-to-most: wait this long for a response before stepping up one prompt level. */
  leastToMostWaitMs: 5000,
  /**
   * Least-to-most, after a wrong tap: true = re-present at the full prompt
   * (the error-correction rule), false = step up just one level.
   */
  leastToMostErrorGoesToFullPrompt: true,

  /** Inter-trial pause options (ms) and default. */
  interTrialPauseOptionsMs: [2000, 2500, 3000],
  interTrialPauseMs: 2500,

  /** Token board sizes a therapist can choose, and the default. */
  tokenBoardSizes: [3, 5, 10],
  tokenBoardSize: 5,
  /** Does a prompted correct answer earn a token? */
  tokensForPrompted: true,

  /** Mastery: independent correct % in Check, across N consecutive sessions. */
  masteryPercentOptions: [80, 90, 100],
  masteryPercent: 90,
  masterySessionOptions: [1, 2, 3],
  masterySessions: 2,

  /** Mastered lessons come back as a short review after this many days. */
  reviewIntervalDays: 7,
  reviewTrials: 5,

  /** Counterbalancing: sides are balanced within blocks of this size, with a max run. */
  blockSize: 10,
  maxSameSideRun: 2,

  /** Position bias: flag when either side gets more than this share of the last N taps. */
  biasWindow: 20,
  biasThreshold: 0.7,

  /** Keep trial-level data for this many recent sessions per learner and lesson. */
  trialHistorySessions: 50,

  /** "Can" is taught before "Can't" (negation is harder). A therapist can override per learner. */
  canBeforeCant: true,

  defaultStrategy: "errorless" as const,
} as const;

export type PromptingStrategy = "errorless" | "least-to-most";
