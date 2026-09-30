import { TEACHING } from "@/config/teaching";
import { defaultProgress, type Learner, type Lesson, type LessonProgress, type LearnerSettings, type TrialRecord } from "./schema";
import { isIndependent } from "./trial";

const DAY = 24 * 60 * 60 * 1000;

/** Errorless time delay: step up after N good sessions in a row, step down after a bad one. */
export function nextDelayStep(
  p: Pick<LessonProgress, "delayStep" | "delayGoodSessions">,
  unpromptedErrors: number,
): Pick<LessonProgress, "delayStep" | "delayGoodSessions"> {
  const max = TEACHING.timeDelaySteps.length - 1;
  if (unpromptedErrors >= TEACHING.timeDelayStepDownErrors) {
    return { delayStep: Math.max(0, p.delayStep - 1), delayGoodSessions: 0 };
  }
  if (unpromptedErrors <= TEACHING.timeDelayStepUpMaxErrors) {
    const good = p.delayGoodSessions + 1;
    if (good >= TEACHING.timeDelayStepUpSessions) return { delayStep: Math.min(max, p.delayStep + 1), delayGoodSessions: 0 };
    return { delayStep: p.delayStep, delayGoodSessions: good };
  }
  return { delayStep: p.delayStep, delayGoodSessions: 0 };
}

export const delaySecondsFor = (step: number) =>
  TEACHING.timeDelaySteps[Math.min(step, TEACHING.timeDelaySteps.length - 1)];

/** Independent correct % over Check (or review) first-try records. */
export function independentPercent(records: TrialRecord[]): number | null {
  const probe = records.filter((r) => r.step === "check" || r.step === "review");
  if (probe.length === 0) return null;
  return Math.round((probe.filter(isIndependent).length / probe.length) * 100);
}

export interface SessionOutcome {
  kind: "lesson" | "review";
  /** Check completed (lesson) or all review trials done. */
  completed: boolean;
  percent: number | null;
  strategy: LearnerSettings["strategy"];
  /** Only for errorless lesson sessions whose Practise step was completed. */
  practiseUnpromptedErrors: number | null;
}

/** Apply one finished session to a learner's progress on a lesson. */
export function applySession(
  prev: LessonProgress,
  o: SessionOutcome,
  settings: LearnerSettings,
  now: number,
): { progress: LessonProgress; becameMastered: boolean; reviewFailed: boolean } {
  let p = { ...prev };
  if (o.strategy === "errorless" && o.practiseUnpromptedErrors !== null) {
    p = { ...p, ...nextDelayStep(p, o.practiseUnpromptedErrors) };
  }
  if (!o.completed || o.percent === null) return { progress: p, becameMastered: false, reviewFailed: false };

  if (o.kind === "review") {
    if (o.percent >= settings.masteryPercent) return { progress: { ...p, lastReviewAt: now }, becameMastered: false, reviewFailed: false };
    return {
      progress: { ...p, masteredAt: null, masteryStreak: 0, needsPractice: true, lastReviewAt: now },
      becameMastered: false,
      reviewFailed: true,
    };
  }

  p.sessionsCompleted += 1;
  p.masteryStreak = o.percent >= settings.masteryPercent ? p.masteryStreak + 1 : 0;
  const becameMastered = p.masteredAt === null && p.masteryStreak >= settings.masterySessions;
  if (becameMastered) {
    p = { ...p, masteredAt: now, everMastered: true, needsPractice: false, lastReviewAt: now };
  }
  return { progress: p, becameMastered, reviewFailed: false };
}

export function isReviewDue(p: LessonProgress, settings: LearnerSettings, now: number): boolean {
  if (p.masteredAt === null) return false;
  const since = p.lastReviewAt ?? p.masteredAt;
  return now - since >= settings.reviewIntervalDays * DAY;
}

export type LessonStatus = "new" | "in-progress" | "mastered" | "review-due";

export function lessonStatus(lesson: Lesson, learner: Learner, now: number): LessonStatus {
  const p = learner.progress[lesson.id] ?? defaultProgress();
  if (p.masteredAt !== null) return isReviewDue(p, learner.settings, now) ? "review-due" : "mastered";
  if (p.sessionsCompleted > 0 || p.needsPractice) return "in-progress";
  return "new";
}
