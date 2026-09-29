import { describe, expect, it } from "vitest";
import { applySession, isLocked, isReviewDue, lessonStars, lessonStatus, nextDelayStep } from "@/lib/progress";
import { defaultLessons } from "@/lib/lessons";
import { defaultProgress, defaultSettings, type Learner } from "@/lib/schema";

const DAY = 86_400_000;
const learner = (over: Partial<Learner> = {}): Learner => ({
  id: "l1",
  nickname: "Test",
  avatar: "sun",
  createdAt: 0,
  demo: false,
  settings: defaultSettings(),
  progress: {},
  stickers: [],
  assigned: ["can", "cant"],
  ...over,
});
const lesson = { kind: "lesson" as const, completed: true, strategy: "errorless" as const, practiseUnpromptedErrors: null };

describe("time-delay progression", () => {
  it("steps up 0 → 2 → 3 → 5 s after 2 sessions with ≤1 unprompted error, and stops at 5", () => {
    let p = { delayStep: 0, delayGoodSessions: 0 };
    const seen: number[] = [];
    for (let i = 0; i < 8; i++) {
      p = nextDelayStep(p, i % 2);
      seen.push(p.delayStep);
    }
    expect(seen).toEqual([0, 1, 1, 2, 2, 3, 3, 3]);
  });

  it("steps down one after a session with 3+ unprompted errors, never below 0", () => {
    expect(nextDelayStep({ delayStep: 2, delayGoodSessions: 1 }, 3)).toEqual({ delayStep: 1, delayGoodSessions: 0 });
    expect(nextDelayStep({ delayStep: 0, delayGoodSessions: 0 }, 5)).toEqual({ delayStep: 0, delayGoodSessions: 0 });
  });

  it("2 unprompted errors neither steps up nor down, and breaks the streak", () => {
    expect(nextDelayStep({ delayStep: 1, delayGoodSessions: 1 }, 2)).toEqual({ delayStep: 1, delayGoodSessions: 0 });
  });

  it("is applied from errorless practise results", () => {
    const s = defaultSettings();
    let p = defaultProgress();
    for (let i = 0; i < 2; i++) p = applySession(p, { ...lesson, percent: 50, practiseUnpromptedErrors: 0 }, s, i).progress;
    expect(p.delayStep).toBe(1);
  });
});

describe("mastery", () => {
  it("masters at 90% across 2 consecutive sessions (defaults)", () => {
    const s = defaultSettings();
    let p = defaultProgress();
    let r = applySession(p, { ...lesson, percent: 90 }, s, 1);
    expect(r.becameMastered).toBe(false);
    r = applySession(r.progress, { ...lesson, percent: 80 }, s, 2);
    expect(r.progress.masteryStreak).toBe(0);
    r = applySession(r.progress, { ...lesson, percent: 100 }, s, 3);
    r = applySession(r.progress, { ...lesson, percent: 90 }, s, 4);
    expect(r.becameMastered).toBe(true);
    p = r.progress;
    expect(p).toMatchObject({ masteredAt: 4, everMastered: true, lastReviewAt: 4 });
  });

  it("respects a per-learner criterion (80%, 1 session)", () => {
    const s = { ...defaultSettings(), masteryPercent: 80 as const, masterySessions: 1 };
    expect(applySession(defaultProgress(), { ...lesson, percent: 80 }, s, 1).becameMastered).toBe(true);
  });

  it("incomplete sessions do not count", () => {
    const r = applySession(defaultProgress(), { ...lesson, completed: false, percent: 100 }, defaultSettings(), 1);
    expect(r.progress.masteryStreak).toBe(0);
    expect(r.progress.sessionsCompleted).toBe(0);
  });
});

describe("review scheduling", () => {
  const mastered = { ...defaultProgress(), masteredAt: 0, everMastered: true, lastReviewAt: 0 };

  it("is due after the review interval (7 days by default)", () => {
    expect(isReviewDue(mastered, defaultSettings(), 6 * DAY)).toBe(false);
    expect(isReviewDue(mastered, defaultSettings(), 7 * DAY)).toBe(true);
    expect(isReviewDue(mastered, { ...defaultSettings(), reviewIntervalDays: 14 }, 10 * DAY)).toBe(false);
  });

  it("a passed review schedules the next one", () => {
    const r = applySession(mastered, { ...lesson, kind: "review", percent: 100 }, defaultSettings(), 8 * DAY);
    expect(r.progress.lastReviewAt).toBe(8 * DAY);
    expect(isReviewDue(r.progress, defaultSettings(), 9 * DAY)).toBe(false);
  });

  it("a failed review marks the lesson as needing practice again", () => {
    const r = applySession(mastered, { ...lesson, kind: "review", percent: 60 }, defaultSettings(), 8 * DAY);
    expect(r.reviewFailed).toBe(true);
    expect(r.progress).toMatchObject({ masteredAt: null, needsPractice: true, everMastered: true });
  });
});

describe("unlock rule and status", () => {
  const lessons = defaultLessons();
  const [can, cant] = lessons;

  it("Can't is locked until Can has been mastered", () => {
    expect(isLocked(cant, learner(), lessons)).toBe(true);
    expect(isLocked(can, learner(), lessons)).toBe(false);
    const done = learner({ progress: { can: { ...defaultProgress(), everMastered: true, masteredAt: 1 } } });
    expect(isLocked(cant, done, lessons)).toBe(false);
  });

  it("a therapist override unlocks Can't straight away", () => {
    expect(isLocked(cant, learner({ settings: { ...defaultSettings(), canBeforeCant: false } }), lessons)).toBe(false);
  });

  it("stays unlocked after a failed Can review", () => {
    const l = learner({ progress: { can: { ...defaultProgress(), everMastered: true, masteredAt: null, needsPractice: true } } });
    expect(isLocked(cant, l, lessons)).toBe(false);
    expect(lessonStatus(can, l, lessons, 0)).toBe("in-progress");
  });

  it("derives new / mastered / review-due", () => {
    expect(lessonStatus(can, learner(), lessons, 0)).toBe("new");
    const l = learner({ progress: { can: { ...defaultProgress(), everMastered: true, masteredAt: 0, lastReviewAt: 0, sessionsCompleted: 2 } } });
    expect(lessonStatus(can, l, lessons, DAY)).toBe("mastered");
    expect(lessonStatus(can, l, lessons, 8 * DAY)).toBe("review-due");
  });
});

describe("library stars", () => {
  it("one per completed session up to two, three once mastered, never taken away", () => {
    const p = defaultProgress();
    expect(lessonStars(p)).toBe(0);
    expect(lessonStars({ ...p, sessionsCompleted: 1 })).toBe(1);
    expect(lessonStars({ ...p, sessionsCompleted: 7 })).toBe(2);
    expect(lessonStars({ ...p, sessionsCompleted: 2, everMastered: true })).toBe(3);
    // A failed review clears masteredAt but keeps the stars.
    expect(lessonStars({ ...p, sessionsCompleted: 2, everMastered: true, masteredAt: null, needsPractice: true })).toBe(3);
  });
});
