import { z } from "zod";
import { CHARACTER_IDS } from "@/data/characters";
import { TEACHING } from "@/config/teaching";

export const SCHEMA_VERSION = 1;

export const CharacterIdSchema = z.enum(CHARACTER_IDS);
export const SideSchema = z.enum(["left", "right"]);
export const PolaritySchema = z.enum(["can", "cant"]);
export const StrategySchema = z.enum(["errorless", "least-to-most"]);
export const RewardSchema = z.enum(["bubbles", "stars", "fish"]);
export const AvatarSchema = z.enum(["sun", "leaf", "kite", "boat", "moon", "flower"]);
export const PromptLevelSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
export const TrialStepSchema = z.enum(["practise", "check", "review", "missed"]);

export const ItemSchema = z.object({
  id: z.string().min(1),
  verb: z.string(),
  optionA: CharacterIdSchema,
  optionB: CharacterIdSchema,
  answer: CharacterIdSchema,
  status: z.enum(["approved", "draft"]),
});

export const LessonSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  polarity: PolaritySchema,
  items: z.array(ItemSchema),
});

export const LearnerSettingsSchema = z.object({
  calmMode: z.boolean().default(true),
  /** Playback rate: 0.8 slower, 1 normal, 1.2 faster (the recording itself is already slow). */
  voiceRate: z.number().min(0.7).max(1.2).default(1),
  textSize: z.enum(["regular", "large"]).default("regular"),
  voiceOn: z.boolean().default(true),
  strategy: StrategySchema.default(TEACHING.defaultStrategy),
  masteryPercent: z.union([z.literal(80), z.literal(90), z.literal(100)]).default(TEACHING.masteryPercent),
  masterySessions: z.int().min(1).max(3).default(TEACHING.masterySessions),
  reviewIntervalDays: z.int().min(1).max(60).default(TEACHING.reviewIntervalDays),
});

export const LessonProgressSchema = z.object({
  /** Index into TEACHING.timeDelaySteps (errorless). */
  delayStep: z.int().min(0).default(0),
  /** Consecutive qualifying sessions at the current delay step. */
  delayGoodSessions: z.int().min(0).default(0),
  /** Consecutive sessions meeting the mastery criterion. */
  masteryStreak: z.int().min(0).default(0),
  masteredAt: z.number().nullable().default(null),
  everMastered: z.boolean().default(false),
  lastReviewAt: z.number().nullable().default(null),
  needsPractice: z.boolean().default(false),
  sessionsCompleted: z.int().min(0).default(0),
});

export const LearnerSchema = z.object({
  id: z.string().min(1),
  nickname: z.string().min(1).max(24),
  avatar: AvatarSchema,
  createdAt: z.number(),
  demo: z.boolean().default(false),
  settings: LearnerSettingsSchema,
  progress: z.record(z.string(), LessonProgressSchema).default({}),
  stickers: z.array(z.string()).default([]),
  /** Lessons that appear in the child's library. */
  assigned: z.array(z.string()).default(["can", "cant"]),
});

export const TrialRecordSchema = z.object({
  itemId: z.string(),
  step: TrialStepSchema,
  correctSide: SideSchema,
  tappedSide: SideSchema,
  correct: z.boolean(),
  /** 0 = independent; 1–3 = prompted at that level. */
  promptLevel: PromptLevelSchema,
  /** True for the re-presentation after an error. */
  correction: z.boolean(),
  latencyMs: z.number().min(0),
  at: z.number(),
});

export const SessionSummarySchema = z.object({
  checkTotal: z.int(),
  checkIndependentCorrect: z.int(),
  /** Taps by prompt level: [independent, level 1, level 2, level 3]. */
  promptCounts: z.tuple([z.int(), z.int(), z.int(), z.int()]),
  meanLatencyMs: z.number().nullable(),
  unpromptedErrors: z.int(),
  breakCount: z.int(),
  breakMs: z.number(),
  taps: z.object({ left: z.int(), right: z.int() }),
});

export const SessionSchema = z.object({
  id: z.string(),
  learnerId: z.string(),
  lessonId: z.string(),
  kind: z.enum(["lesson", "review"]),
  seed: z.int(),
  startedAt: z.number(),
  endedAt: z.number().nullable(),
  completed: z.boolean(),
  strategy: StrategySchema,
  delaySeconds: z.number(),
  reward: RewardSchema,
  breaks: z.array(z.object({ start: z.number(), end: z.number().nullable() })),
  /** Trial-level data; emptied for sessions older than the last 50 (summary kept). */
  trials: z.array(TrialRecordSchema),
  summary: SessionSummarySchema.nullable(),
});

export const PersistedStateSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  learners: z.array(LearnerSchema),
  lessons: z.array(LessonSchema),
  sessions: z.array(SessionSchema),
  activeLearnerId: z.string().nullable(),
  muted: z.boolean(),
});

export type Side = z.infer<typeof SideSchema>;
export type Polarity = z.infer<typeof PolaritySchema>;
export type Strategy = z.infer<typeof StrategySchema>;
export type RewardId = z.infer<typeof RewardSchema>;
export type AvatarId = z.infer<typeof AvatarSchema>;
export type PromptLevel = z.infer<typeof PromptLevelSchema>;
export type TrialStep = z.infer<typeof TrialStepSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type LearnerSettings = z.infer<typeof LearnerSettingsSchema>;
export type LessonProgress = z.infer<typeof LessonProgressSchema>;
export type Learner = z.infer<typeof LearnerSchema>;
export type TrialRecord = z.infer<typeof TrialRecordSchema>;
export type SessionSummary = z.infer<typeof SessionSummarySchema>;
export type Session = z.infer<typeof SessionSchema>;
export type PersistedState = z.infer<typeof PersistedStateSchema>;

export const defaultSettings = (): LearnerSettings => LearnerSettingsSchema.parse({});
export const defaultProgress = (): LessonProgress => LessonProgressSchema.parse({});
