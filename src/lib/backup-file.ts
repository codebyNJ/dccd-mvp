import { makeBackup } from "./migrate";
import type { PersistedState } from "./schema";

/** Save all data as a JSON file on this device. */
export function downloadBackup(s: PersistedState) {
  const state: PersistedState = {
    schemaVersion: s.schemaVersion,
    learners: s.learners,
    lessons: s.lessons,
    sessions: s.sessions,
    activeLearnerId: s.activeLearnerId,
    muted: s.muted,
  };
  const blob = new Blob([JSON.stringify(makeBackup(state, Date.now()), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dccd-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
