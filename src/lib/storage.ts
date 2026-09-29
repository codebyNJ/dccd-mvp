import type { StateStorage } from "zustand/middleware";

/** The one place the app touches localStorage. */
export const STORAGE_KEY = "dccd-learning-studio";

let quotaFull = false;
const listeners = new Set<() => void>();
const setQuota = (v: boolean) => {
  if (quotaFull === v) return;
  quotaFull = v;
  listeners.forEach((l) => l());
};

export const quotaStore = {
  subscribe: (l: () => void) => (listeners.add(l), () => void listeners.delete(l)),
  get: () => quotaFull,
  getServer: () => false,
};

const isQuotaError = (e: unknown) =>
  e instanceof DOMException && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22);

export const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
      setQuota(false);
    } catch (e) {
      if (isQuotaError(e)) setQuota(true);
      else throw e;
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* storage unavailable: nothing to remove */
    }
  },
};

/** Keep unreadable stored data aside instead of silently overwriting it. */
export function stashUnreadable(raw: unknown) {
  try {
    localStorage.setItem(`${STORAGE_KEY}-unreadable-${Date.now()}`, JSON.stringify(raw));
  } catch {
    /* best effort */
  }
}
