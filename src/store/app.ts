import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { TEACHING } from "@/config/teaching";
import { makeDemoData } from "@/lib/demo";
import { deckItems, newItemId } from "@/lib/lessons";
import { emptyState, migrateState } from "@/lib/migrate";
import { applySession, independentPercent } from "@/lib/progress";
import {
  defaultProgress,
  defaultSettings,
  SCHEMA_VERSION,
  type AvatarId,
  type Item,
  type Learner,
  type LearnerSettings,
  type PersistedState,
  type Session,
} from "@/lib/schema";
import { closeDangling, summarize, trimHistory } from "@/lib/session";
import { safeLocalStorage, stashUnreadable, STORAGE_KEY } from "@/lib/storage";
import { unpromptedErrors } from "@/lib/trial";

export interface FinishResult {
  becameMastered: boolean;
  reviewFailed: boolean;
}

interface Actions {
  addLearner: (nickname: string, avatar: AvatarId) => string;
  updateLearner: (id: string, patch: Partial<Pick<Learner, "nickname" | "avatar" | "assigned">>) => void;
  updateSettings: (id: string, patch: Partial<LearnerSettings>) => void;
  resetDelay: (id: string, lessonId: string) => void;
  deleteLearner: (id: string) => void;
  setActiveLearner: (id: string | null) => void;
  setMuted: (muted: boolean) => void;

  updateItem: (lessonId: string, itemId: string, patch: Partial<Omit<Item, "id">>) => void;
  addItem: (lessonId: string) => void;
  deleteItem: (lessonId: string, itemId: string) => void;
  addItems: (lessonId: string, items: Omit<Item, "id">[]) => void;
  resetLesson: (lessonId: string) => void;

  /** Save a session in progress (called after every trial, so a closed tab loses nothing). */
  saveSession: (s: Session) => void;
  /** End a session: summary, progress, mastery, sticker. */
  finishSession: (s: Session, opts: { practiseCompleted: boolean }) => FinishResult;

  replaceAll: (state: PersistedState) => void;
  loadDemo: () => void;
  clearAll: () => void;
}

export interface AppState extends PersistedState, Actions {
  hydrated: boolean;
  loadError: string | null;
}

const persisted = (s: AppState): PersistedState => ({
  schemaVersion: s.schemaVersion,
  learners: s.learners,
  lessons: s.lessons,
  sessions: s.sessions,
  activeLearnerId: s.activeLearnerId,
  muted: s.muted,
});

const mapLearner = (s: AppState, id: string, fn: (l: Learner) => Learner) => ({
  learners: s.learners.map((l) => (l.id === id ? fn(l) : l)),
});

const mapItems = (s: AppState, lessonId: string, fn: (items: Item[]) => Item[]) => ({
  lessons: s.lessons.map((l) => (l.id === lessonId ? { ...l, items: fn(l.items) } : l)),
});

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      ...emptyState(),
      hydrated: false,
      loadError: null,

      addLearner: (nickname, avatar) => {
        const id = `l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const learner: Learner = {
          id,
          nickname: nickname.trim().slice(0, 24),
          avatar,
          createdAt: Date.now(),
          demo: false,
          settings: defaultSettings(),
          progress: {},
          stickers: [],
          assigned: get().lessons.map((l) => l.id),
        };
        set((s) => ({ learners: [...s.learners, learner] }));
        return id;
      },
      updateLearner: (id, patch) => set((s) => mapLearner(s, id, (l) => ({ ...l, ...patch }))),
      updateSettings: (id, patch) => set((s) => mapLearner(s, id, (l) => ({ ...l, settings: { ...l.settings, ...patch } }))),
      resetDelay: (id, lessonId) =>
        set((s) =>
          mapLearner(s, id, (l) => ({
            ...l,
            progress: { ...l.progress, [lessonId]: { ...(l.progress[lessonId] ?? defaultProgress()), delayStep: 0, delayGoodSessions: 0 } },
          })),
        ),
      deleteLearner: (id) =>
        set((s) => ({
          learners: s.learners.filter((l) => l.id !== id),
          sessions: s.sessions.filter((x) => x.learnerId !== id),
          activeLearnerId: s.activeLearnerId === id ? null : s.activeLearnerId,
        })),
      setActiveLearner: (id) => set({ activeLearnerId: id }),
      setMuted: (muted) => set({ muted }),

      updateItem: (lessonId, itemId, patch) =>
        set((s) => mapItems(s, lessonId, (items) => items.map((i) => (i.id === itemId ? fixAnswer({ ...i, ...patch }) : i)))),
      addItem: (lessonId) =>
        set((s) =>
          mapItems(s, lessonId, (items) => [...items, { id: newItemId(), verb: "", optionA: "dog", optionB: "cat", answer: "cat", status: "draft" }]),
        ),
      deleteItem: (lessonId, itemId) => set((s) => mapItems(s, lessonId, (items) => items.filter((i) => i.id !== itemId))),
      addItems: (lessonId, rows) => set((s) => mapItems(s, lessonId, (items) => [...items, ...rows.map((r) => ({ ...r, id: newItemId() }))])),
      resetLesson: (lessonId) => set((s) => mapItems(s, lessonId, () => deckItems())),

      saveSession: (session) =>
        set((s) => {
          const exists = s.sessions.some((x) => x.id === session.id);
          const sessions = exists ? s.sessions.map((x) => (x.id === session.id ? session : x)) : [...s.sessions, session];
          return { sessions: exists ? sessions : trimHistory(sessions, TEACHING.trialHistorySessions) };
        }),

      finishSession: (session, { practiseCompleted }) => {
        const now = Date.now();
        const breaks = session.breaks.map((b) => (b.end === null ? { ...b, end: now } : b));
        const done: Session = { ...session, breaks, endedAt: now, summary: summarize({ trials: session.trials, breaks }, now) };
        get().saveSession(done);
        const learner = get().learners.find((l) => l.id === session.learnerId);
        if (!learner) return { becameMastered: false, reviewFailed: false };
        const res = applySession(
          learner.progress[session.lessonId] ?? defaultProgress(),
          {
            kind: session.kind,
            completed: session.completed,
            percent: independentPercent(session.trials),
            strategy: session.strategy,
            practiseUnpromptedErrors:
              session.strategy === "errorless" && practiseCompleted && session.kind === "lesson"
                ? unpromptedErrors(session.trials.filter((r) => r.step === "practise"))
                : null,
          },
          learner.settings,
          now,
        );
        set((s) =>
          mapLearner(s, learner.id, (l) => ({
            ...l,
            progress: { ...l.progress, [session.lessonId]: res.progress },
            stickers: res.becameMastered && !l.stickers.includes(session.lessonId) ? [...l.stickers, session.lessonId] : l.stickers,
          })),
        );
        return { becameMastered: res.becameMastered, reviewFailed: res.reviewFailed };
      },

      replaceAll: (state) => set({ ...state, loadError: null }),
      loadDemo: () => {
        const s = get();
        const demo = makeDemoData(s.lessons, Date.now());
        set({
          learners: [...s.learners.filter((l) => !l.demo), ...demo.learners],
          sessions: [...s.sessions.filter((x) => !x.learnerId.startsWith("demo-")), ...demo.sessions],
        });
      },
      clearAll: () => set({ ...emptyState(), loadError: null }),
    }),
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: persisted,
      skipHydration: true,
      // Always run our own migration + Zod validation; never silently drop unreadable data.
      migrate: (state) => state as PersistedState,
      merge: (stored, current) => {
        if (stored === undefined || stored === null) return current;
        const r = migrateState(stored);
        if (!r.ok) {
          stashUnreadable(stored);
          return { ...current, loadError: r.error };
        }
        return { ...current, ...r.state, sessions: trimHistory(closeDangling(r.state.sessions)) };
      },
      onRehydrateStorage: () => () => useApp.setState({ hydrated: true }),
    },
  ),
);

/** Keep the answer valid when an option changes in the editor. */
function fixAnswer(i: Item): Item {
  return i.answer === i.optionA || i.answer === i.optionB ? i : { ...i, answer: i.optionB };
}

export const useActiveLearner = () => useApp((s) => s.learners.find((l) => l.id === s.activeLearnerId) ?? null);
