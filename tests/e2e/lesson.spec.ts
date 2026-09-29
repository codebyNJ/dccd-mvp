import { answerTrials, expect, learner, seed, stored, test } from "./helpers";

test("Can: Watch, Practise, Check and Reward, with tokens, board-full reward and mastery sticker", async ({ page }) => {
  await seed(page, {
    learners: [learner("l1", "Mira", { tokenBoardSize: 3, masteryPercent: 80, masterySessions: 1 })],
    activeLearnerId: "l1",
  });
  await page.goto("/");
  await expect(page.getByText("Can’t").first()).toBeVisible();
  await expect(page.getByLabel(/Can’t: Unlocks after Can/)).toBeVisible();
  await page.getByRole("link", { name: /Open Can: New/ }).click();

  // Choice of reward before the session.
  await expect(page.getByRole("heading", { name: "Pick your reward" })).toBeVisible();
  await page.getByRole("button", { name: "Bubbles" }).click();

  // Watch: ten slides, then Practise.
  await expect(page).toHaveURL(/step=watch/);
  for (let i = 0; i < 9; i++) await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Practise" }).click();
  await expect(page).toHaveURL(/step=practise/);

  // Practise: errorless at 0 s; a board of 3 fills (and the reward plays) three times.
  const { boardsFilled } = await answerTrials(page, { trials: 10 });
  expect(boardsFilled).toBeGreaterThanOrEqual(2);
  await expect(page).toHaveURL(/step=check/);
  await answerTrials(page, { trials: 10, wrongOn: [4] });

  // One miss in Check: offered practice of the missed ones.
  await expect(page.getByRole("button", { name: "Practise them" })).toBeVisible();
  await page.getByRole("button", { name: "Practise them" }).click();
  await answerTrials(page, { trials: 1 });

  // Reward + sticker (90% ≥ 80% over 1 session).
  await expect(page).toHaveURL(/step=reward/);
  await expect(page.getByText("New sticker")).toBeVisible();
  const s = await stored(page);
  const session = s.sessions[0];
  expect(session.completed).toBe(true);
  expect(session.summary?.checkTotal).toBe(10);
  expect(session.summary?.checkIndependentCorrect).toBe(9);
  // Errorless at 0 s: the full prompt comes straight after the instruction and no practise answer is an error.
  const practise = session.trials.filter((t) => t.step === "practise");
  expect(practise.every((t) => t.correct)).toBe(true);
  expect(practise.some((t) => t.promptLevel === 3)).toBe(true);
  expect(session.trials.filter((t) => t.step === "missed")).toHaveLength(1);
  // Counterbalanced: 5 left / 5 right in each 10-trial step, no more than 2 in a row.
  for (const step of ["practise", "check"] as const) {
    const sides = session.trials.filter((t) => t.step === step && !t.correction).map((t) => t.correctSide);
    expect(sides.filter((x) => x === "left")).toHaveLength(5);
    expect(sides.join(",")).not.toMatch(/(left,left,left|right,right,right)/);
  }
  expect(s.learners[0].stickers).toEqual(["can"]);

  // Can't is now unlocked and the sticker is in the book.
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByRole("link", { name: /Open Can’t: New/ })).toBeVisible();
  await expect(page.getByRole("img", { name: "Can" })).toBeVisible();
});

test("Can’t, least-to-most: a wrong tap gets “Let’s try again”, a full prompt, and is recorded as prompted", async ({ page }) => {
  await seed(page, {
    learners: [learner("l1", "Ravi", { strategy: "least-to-most", canBeforeCant: false })],
    activeLearnerId: "l1",
  });
  await page.goto("/lesson/?id=cant&step=practise");
  await page.getByRole("button", { name: "Star garden" }).click();
  await expect(page).toHaveURL(/step=practise/);
  await answerTrials(page, { trials: 2, wrongOn: [0] });

  const s = await stored(page);
  const t = s.sessions[0].trials;
  expect(t[0]).toMatchObject({ correct: false, promptLevel: 0, correction: false });
  expect(t[1]).toMatchObject({ correct: true, promptLevel: 3, correction: true });
  expect(t[2]).toMatchObject({ correct: true, correction: false });
});

test("Least-to-most steps up one prompt level after no response", async ({ page }) => {
  await seed(page, { learners: [learner("l1", "Ravi", { strategy: "least-to-most" })], activeLearnerId: "l1" });
  await page.goto("/lesson/?id=can&step=practise");
  await page.getByRole("button", { name: "Swimming fish" }).click();
  // Record every card state the correct card passes through while nobody taps.
  await page.locator("button.char-card").first().waitFor();
  await page.evaluate(() => {
    const w = window as unknown as { __states: string[] };
    w.__states = [];
    new MutationObserver((ms) => ms.forEach((m) => w.__states.push((m.target as Element).getAttribute("data-state") ?? ""))).observe(document.body, {
      subtree: true,
      attributeFilter: ["data-state"],
    });
  });
  // No tap: level 2 (glow) then level 3 (card grows and the guide points).
  await expect(page.locator('button.char-card[data-state="prompted"]')).toHaveCount(1);
  const states = await page.evaluate(() => (window as unknown as { __states: string[] }).__states);
  expect(states.indexOf("glow")).toBeGreaterThanOrEqual(0);
  expect(states.indexOf("glow")).toBeLessThan(states.indexOf("prompted"));
  await page.locator('button.char-card[data-state="prompted"]').click();
  await expect.poll(async () => (await stored(page)).sessions[0].trials[0]?.promptLevel).toBe(3);
});

test("Break: calm screen, lesson waits, Ready resumes; the break is recorded", async ({ page }) => {
  await seed(page, { learners: [learner("l1", "Mira")], activeLearnerId: "l1" });
  await page.goto("/lesson/?id=can&step=practise");
  await page.getByRole("button", { name: "Bubbles" }).click();
  await expect(page.locator("button.char-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Break" }).click();
  await expect(page.getByRole("dialog", { name: "Break time" })).toBeVisible();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Ready" }).click();
  await answerTrials(page, { trials: 1 });
  const s = await stored(page);
  expect(s.sessions[0].breaks).toHaveLength(1);
  expect(s.sessions[0].breaks[0].end).not.toBeNull();
});

test("Draft items never reach a child", async ({ page }) => {
  await seed(page, { learners: [learner("l1", "Mira")], activeLearnerId: "l1" });
  await page.goto("/grown-up/?tab=lessons");
  // Turn every Can item except two into drafts.
  const statuses = page.getByRole("combobox", { name: /^Status:/ });
  const n = await statuses.count();
  for (let i = 2; i < n; i++) await statuses.nth(i).selectOption("draft");
  await page.goto("/lesson/?id=can&step=practise");
  await page.getByRole("button", { name: "Bubbles" }).click();
  await answerTrials(page, { trials: 4 });
  const s = await stored(page);
  const seen = new Set(s.sessions[0].trials.map((t) => t.itemId));
  expect([...seen].sort()).toEqual(["dccd-01", "dccd-02"]);
});

test("Review after 7 days: 5 Check trials; a failed review sets needs-practice", async ({ page }) => {
  const DAY = 86_400_000;
  const l = learner("l1", "Mira", {}, {
    stickers: ["can"],
    progress: {
      can: {
        delayStep: 3,
        delayGoodSessions: 0,
        masteryStreak: 2,
        masteredAt: Date.now() - 8 * DAY,
        everMastered: true,
        lastReviewAt: Date.now() - 8 * DAY,
        needsPractice: false,
        sessionsCompleted: 4,
      },
    },
  });
  await seed(page, { learners: [l], activeLearnerId: "l1" });
  await page.goto("/");
  await page.getByRole("link", { name: /Open Can: Review/ }).click();
  await page.getByRole("button", { name: "Bubbles" }).click();
  await expect(page).toHaveURL(/step=check/);
  await answerTrials(page, { trials: 5, wrongOn: [0, 1, 2] });
  await expect(page).toHaveURL(/step=reward/);
  const s = await stored(page);
  expect(s.sessions[0].kind).toBe("review");
  expect(s.sessions[0].trials).toHaveLength(5);
  expect(s.learners[0].progress.can).toMatchObject({ needsPractice: true, masteredAt: null });
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByRole("link", { name: /Open Can: Keep going/ })).toBeVisible();
  // Can't stays unlocked: Can was mastered once.
  await expect(page.getByRole("link", { name: /Open Can’t/ })).toBeVisible();
});
