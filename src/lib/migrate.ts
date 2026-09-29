import { z } from "zod";
import { PersistedStateSchema, SCHEMA_VERSION, type PersistedState } from "./schema";
import { defaultLessons } from "./lessons";

export type MigrateResult = { ok: true; state: PersistedState } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export const emptyState = (): PersistedState => ({
  schemaVersion: SCHEMA_VERSION,
  learners: [],
  lessons: defaultLessons(),
  sessions: [],
  activeLearnerId: null,
  muted: false,
});

/**
 * Bring stored or imported data up to the current schema, then validate it.
 * Accepts the raw persisted state or a backup file ({ app, exportedAt, state }).
 *
 * Version 0 = data written before `schemaVersion` existed: lessons, muted and
 * activeLearnerId may be missing, and learner settings/progress may lack fields
 * (the schema fills defaults).
 */
export function migrateState(input: unknown): MigrateResult {
  if (!isObj(input)) return { ok: false, error: "Not a JSON object." };
  let obj: Record<string, unknown> = isObj(input.state) ? input.state : input;
  const version = typeof obj.schemaVersion === "number" ? obj.schemaVersion : 0;
  if (version > SCHEMA_VERSION) return { ok: false, error: `Made by a newer version of the app (schema ${version}).` };

  if (version === 0) {
    obj = {
      schemaVersion: 1,
      learners: obj.learners ?? [],
      lessons: obj.lessons ?? defaultLessons(),
      sessions: obj.sessions ?? [],
      activeLearnerId: obj.activeLearnerId ?? null,
      muted: obj.muted ?? false,
    };
  }
  // Future: if (version === 1) { …transform to 2… }

  const parsed = PersistedStateSchema.safeParse(obj);
  if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error).split("\n").slice(0, 6).join("\n") };
  return { ok: true, state: parsed.data };
}

export const BACKUP_APP = "dccd-learning-studio";

export const makeBackup = (state: PersistedState, now: number) => ({
  app: BACKUP_APP,
  exportedAt: new Date(now).toISOString(),
  state,
});
