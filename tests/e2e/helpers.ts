import { expect, test as base, type Page } from "@playwright/test";
import { DCCD_DECK } from "@/data/deck";
import { emptyState } from "@/lib/migrate";
import { defaultSettings, type Learner, type LearnerSettings, type PersistedState } from "@/lib/schema";
import { STORAGE_KEY } from "@/lib/storage";

/** Waits, prompt delays and silent narration run at this fraction of real time. */
export const TIME_SCALE = 0.05;

/** Every test fails on a console error or an uncaught page error. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("dialog", (d) => void d.accept());
      await page.addInitScript((s) => ((window as unknown as { __DCCD_TIME_SCALE__: number }).__DCCD_TIME_SCALE__ = s), TIME_SCALE);
      await use(errors);
      expect(errors, "console errors").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export function learner(id: string, nickname: string, settings: Partial<LearnerSettings> = {}, extra: Partial<Learner> = {}): Learner {
  return {
    id,
    nickname,
    avatar: "sun",
    createdAt: Date.now(),
    demo: false,
    // Voice off: the silent clock keeps timings without depending on the browser's speech engine.
    settings: { ...defaultSettings(), voiceOn: false, ...settings },
    progress: {},
    stickers: [],
    assigned: ["can", "cant"],
    ...extra,
  };
}

/** Seed localStorage before the app loads (only on the first navigation, so later reloads keep app data). */
export async function seed(page: Page, patch: Partial<PersistedState>) {
  const state: PersistedState = { ...emptyState(), ...patch };
  await page.addInitScript(
    ([key, value]) => {
      if (sessionStorage.getItem("__seeded")) return;
      sessionStorage.setItem("__seeded", "1");
      localStorage.setItem(key, value);
    },
    [STORAGE_KEY, JSON.stringify({ state, version: state.schemaVersion })] as const,
  );
}

export async function stored(page: Page): Promise<PersistedState> {
  const raw = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
  return JSON.parse(raw!).state;
}

const other = (c: string, v: (typeof DCCD_DECK)[number]) => (v.optionA === c ? v.optionB : v.optionA);

/** The character the child should tap for a question such as "Who can’t swim?". */
export function answerFor(instruction: string): string | null {
  const m = /^Who (can’t|can) (.+)\?$/.exec(instruction.replace(/\s+/g, " ").trim());
  if (!m) return null;
  const row = DCCD_DECK.find((r) => r.verb === m[2]);
  if (!row) return null;
  return m[1] === "can" ? other(row.answer, row) : row.answer;
}

export interface ReadOptions {
  /** Pages to read, counted from the page that is open now. */
  pages: number;
  /** Page numbers (1-based, as shown on the page) where the child taps the wrong picture first. */
  wrongOn?: number[];
  /** Learn pages where the child taps the wrong picture twice, so the book shows the answer. */
  wrongTwiceOn?: number[];
}

/** Read pages the way a child does: tap a picture, wait for the page corner, turn. */
export async function readPages(page: Page, { pages, wrongOn = [], wrongTwiceOn = [] }: ReadOptions) {
  const first = Number(await page.locator("[data-page]").getAttribute("data-page"));
  for (let n = first; n < first + pages; n++) {
    const sheet = page.locator(`[data-page="${n}"]`);
    await expect(sheet).toHaveCount(1);
    const correct = answerFor((await sheet.getAttribute("data-question")) ?? "");
    expect(correct, "a known question").not.toBeNull();
    const right = sheet.locator(`button.char-card[data-character="${correct}"]`);
    const wrong = sheet.locator(`button.char-card:not([data-character="${correct}"])`);
    const learn = (await sheet.getAttribute("data-step")) === "practise";

    if (wrongOn.includes(n) || wrongTwiceOn.includes(n)) {
      await wrong.click();
      if (wrongTwiceOn.includes(n)) await wrong.click();
      else if (learn) await right.click();
    } else await right.click();
    await sheet.getByRole("button", { name: "Next page" }).click();
  }
}
