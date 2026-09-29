import type { Page } from "@playwright/test";
import { answerTrials, expect, learner, recordLines, seed, spokenLines, stored, tabTo, test, untilStep } from "./helpers";

/** One whole lesson from the library card to the Reward step. */
async function runLesson(page: Page, opts: { lesson: RegExp; reward: string; practiseWrongOn?: number[] }) {
  await page.getByRole("link", { name: opts.lesson }).click();
  await page.getByRole("button", { name: opts.reward }).click();
  await expect(page).toHaveURL(/step=watch/);
  for (let i = 0; i < 9; i++) await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Practise" }).click();
  const a = await answerTrials(page, { trials: 10, wrongOn: opts.practiseWrongOn });
  const a2 = await untilStep(page, "check");
  const b = await answerTrials(page, { trials: 10 });
  const b2 = await untilStep(page, "reward");
  return { boardsFilled: a.boardsFilled + a2 + b.boardsFilled + b2 };
}

test("Happy path: new learner, reward choice, Watch, Practise with error correction, Check, tokens, mastery over two sessions, Can’t unlocks", async ({ page }) => {
  await recordLines(page);
  await page.goto("/");
  // Grown-up creates the learner (voice off keeps the test independent of the browser's speech engine).
  const lock = page.getByRole("button", { name: /Grown-ups: press and hold/ });
  await lock.hover();
  await page.mouse.down();
  await expect(page).toHaveURL(/grown-up/);
  await page.mouse.up();
  await page.getByRole("button", { name: "Add learner" }).click();
  await page.getByLabel("Nickname").fill("Anu");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByLabel("Voice", { exact: true }).uncheck();
  await page.getByRole("link", { name: "Back to child view" }).click();
  await page.getByRole("button", { name: "Anu" }).click();

  // Session 1: a wrong tap in Practise, then the right one.
  await runLesson(page, { lesson: /Open Can: New/, reward: "Bubbles", practiseWrongOn: [0] });
  const lines = await spokenLines(page);
  // 20 correct answers (the corrected one earns a token too: prompted tokens are on) on a board of 5.
  expect(lines.filter((l) => l === "You filled your board!")).toHaveLength(4);
  expect(lines).toContain("Let’s try again.");
  // No negative words anywhere in what the guide said.
  expect(lines.join(" ")).not.toMatch(/\b(no|wrong|incorrect|oops)\b/i);
  let s = await stored(page);
  const t = s.sessions[0].trials;
  // At the 0 s step the prompt is already up, so the wrong tap is recorded at the level it happened (3).
  expect(t[0]).toMatchObject({ step: "practise", correct: false, correction: false });
  expect(t[1]).toMatchObject({ step: "practise", correct: true, promptLevel: 3, correction: true });
  expect(s.learners[0].progress.can.masteryStreak).toBe(1);
  await expect(page.locator(".a-prompt")).toContainText("All done. Great work!");
  await page.getByRole("button", { name: "Finish" }).click();
  // One session is not mastery (90 % across 2 sessions by default): Can’t is still locked.
  await expect(page.getByLabel(/Can’t: Unlocks after Can/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Open Can: Keep going, 1 star/ })).toBeVisible();

  // Session 2: mastered, sticker, Can’t unlocks.
  await runLesson(page, { lesson: /Open Can: Keep going/, reward: "Swimming fish" });
  await expect(page.getByText("New sticker")).toBeVisible();
  s = await stored(page);
  expect(s.learners[0].stickers).toEqual(["can"]);
  expect(s.sessions[0].seed).not.toBe(s.sessions[1].seed);
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByRole("link", { name: /Open Can: Mastered, 3 stars/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open Can’t: New/ })).toBeVisible();
  await expect(page.getByRole("img", { name: "Can" })).toBeVisible();
});

test("Errorless at the first step shows the prompt 0 s after the instruction", async ({ page }) => {
  await recordLines(page);
  await seed(page, { learners: [learner("l1", "Mira")], activeLearnerId: "l1" });
  await page.goto("/lesson/?id=can&step=practise");
  await page.getByRole("button", { name: "Bubbles" }).click();
  // Nobody taps: the glow + point + "This one." come straight after the instruction.
  const prompted = page.locator('button.char-card[data-state="prompted"]');
  await expect(prompted).toHaveCount(1);
  const lines = await spokenLines(page);
  const i = lines.findIndex((l) => l.startsWith("Who can"));
  expect(i).toBeGreaterThanOrEqual(0);
  expect(lines[i + 1]).toBe("This one.");
  const s = await stored(page);
  expect(s.sessions[0]).toMatchObject({ strategy: "errorless", delaySeconds: 0 });
  await prompted.click();
  await expect.poll(async () => (await stored(page)).sessions[0].trials[0]?.promptLevel).toBe(3);
});

test("Keyboard only: pick learner, open lesson, choose reward, Watch, Practise, Break", async ({ page }) => {
  await seed(page, { learners: [learner("l1", "Mira")] });
  await page.goto("/");
  const press = async (name: string | RegExp, role: "button" | "link" = "button") => {
    const el = page.getByRole(role, { name }).first();
    expect(await tabTo(page, el), `Tab reaches ${name}`).toBe(true);
    // Focus is visible.
    expect(await el.evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe("none");
    await page.keyboard.press("Enter");
  };
  await press("Mira");
  await press(/Open Can: New/, "link");
  await press("Star garden");
  await expect(page).toHaveURL(/step=watch/);
  for (let i = 0; i < 9; i++) await press("Next");
  await press("Practise");
  await expect(page).toHaveURL(/step=practise/);
  await answerTrials(page, { trials: 2, via: "keyboard" });

  // Break: opens with Enter, Ready has focus, Enter resumes.
  await press("Break");
  await expect(page.getByRole("dialog", { name: "Break time" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ready" })).toBeFocused();
  await page.keyboard.press("Enter");
  await answerTrials(page, { trials: 1, via: "keyboard" });
  const s = await stored(page);
  expect(s.sessions[0].trials.filter((t) => t.correct)).toHaveLength(3);
  expect(s.sessions[0].breaks).toHaveLength(1);
});
