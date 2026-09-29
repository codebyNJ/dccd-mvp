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

/** The character the child should tap for an instruction such as "Who can’t swim?". */
export function answerFor(instruction: string): string | null {
  const m = /^Who (can’t|can) (.+)\?$/.exec(instruction.replace(/\s+/g, " ").trim());
  if (!m) return null;
  const row = DCCD_DECK.find((r) => r.verb === m[2]);
  if (!row) return null;
  return m[1] === "can" ? other(row.answer, row) : row.answer;
}

export interface RunOptions {
  /** Trial numbers (0-based, within this call) on which to tap the wrong card first. */
  wrongOn?: number[];
  /** Stop after this many trials. */
  trials: number;
}

/**
 * Answer trials until `trials` have been completed. Uses the glow/prompt state
 * when a prompt is showing, otherwise the instruction text.
 */
export async function answerTrials(page: Page, { trials, wrongOn = [] }: RunOptions): Promise<{ boardsFilled: number }> {
  const keepGoing = page.getByRole("button", { name: "Keep going" });
  let boardsFilled = 0;
  for (let t = 0; t < trials; t++) {
    let tappedWrong = false;
    for (;;) {
      if (await keepGoing.isVisible()) {
        // The dialog fades out after a click; a second click on the leaving button is harmless.
        if (await keepGoing.click({ timeout: 1000 }).then(() => true, () => false)) boardsFilled++;
        continue;
      }
      const ready = page.locator('button.char-card[aria-disabled="false"]');
      if ((await ready.count()) !== 2) {
        await page.waitForTimeout(20);
        continue;
      }
      const prompted = page.locator('button.char-card[data-state="prompted"], button.char-card[data-state="glow"]');
      let correct: string | null = null;
      if ((await prompted.count()) === 1) correct = await prompted.getAttribute("data-character");
      else {
        const line = (await page.locator(".a-prompt p").first().textContent().catch(() => null)) ?? "";
        correct = answerFor(line);
      }
      if (!correct) {
        await page.waitForTimeout(20);
        continue;
      }
      const wrong = wrongOn.includes(t) && !tappedWrong;
      const target = wrong
        ? page.locator(`button.char-card[aria-disabled="false"]:not([data-character="${correct}"])`)
        : page.locator(`button.char-card[aria-disabled="false"][data-character="${correct}"]`);
      if ((await target.count()) !== 1) {
        await page.waitForTimeout(20);
        continue;
      }
      await target.click({ timeout: 2000 }).catch(() => undefined);
      if (wrong) {
        tappedWrong = true;
        // Check moves on after a wrong tap; Practise re-presents the same trial.
        if (!(await page.locator('.a-schedule [aria-current="step"]').textContent())?.includes("Practise")) break;
        continue;
      }
      break;
    }
    // Wait for the cards to leave before the next trial.
    await expect(page.locator('button.char-card[aria-disabled="false"]')).toHaveCount(0);
  }
  return { boardsFilled };
}
