import { defaultLessons } from "@/lib/lessons";
import { answerFor, expect, learner, readPages, seed, stored, test } from "./helpers";

test("Can: cover, 10 learn pages, 10 quiz pages, the end with a sticker; the circle only comes after a tap", async ({ page }) => {
  await seed(page, { learners: [learner("l1", "Mira", { masteryPercent: 80, masterySessions: 1 })], activeLearnerId: "l1" });
  await page.goto("/");
  // No locks: both books are on the shelf.
  await expect(page.getByRole("link", { name: /Open Can’t: New/ })).toBeVisible();
  await page.getByRole("link", { name: /Open Can: New/ }).click();
  await page.getByRole("button", { name: "Open the book" }).click();

  // Page 1: nothing is circled before the child taps.
  const sheet = page.locator('[data-page="1"]');
  await expect(sheet.locator("button.char-card")).toHaveCount(2);
  await expect(sheet.locator(".rough-circle")).toBeHidden();
  await expect(sheet.locator('button.char-card[data-state="answer"]')).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "Next page" })).toHaveCount(0);

  await readPages(page, { pages: 10, wrongOn: [3] });
  await expect(page.locator('[data-page="11"]')).toHaveAttribute("data-step", "check");
  await readPages(page, { pages: 10, wrongOn: [15] });

  await expect(page.getByText("The end", { exact: true })).toBeVisible();
  await expect(page.getByText("New sticker")).toBeVisible();
  const s = await stored(page);
  const session = s.sessions[0];
  expect(session.completed).toBe(true);
  expect(session.summary?.checkTotal).toBe(10);
  expect(session.summary?.checkIndependentCorrect).toBe(9);
  // Learn page 3: a wrong tap, then the right one recorded as a correction.
  const learn = session.trials.filter((t) => t.step === "practise");
  expect(learn).toHaveLength(11);
  expect(learn.filter((t) => t.correction)).toHaveLength(1);
  // Counterbalanced: 5 left / 5 right in each set of 10 pages, no more than 2 in a row.
  for (const step of ["practise", "check"] as const) {
    const sides = session.trials.filter((t) => t.step === step && !t.correction).map((t) => t.correctSide);
    expect(sides.filter((x) => x === "left")).toHaveLength(5);
    expect(sides.join(",")).not.toMatch(/(left,left,left|right,right,right)/);
  }
  expect(s.learners[0].stickers).toEqual(["can"]);

  await page.getByRole("button", { name: "Back to my books" }).click();
  await expect(page.getByRole("link", { name: /Open Can: Mastered/ })).toBeVisible();
  await expect(page.getByRole("img", { name: "Can" })).toBeVisible();
});

test("A right tap draws the circle around that picture; two wrong taps on a learn page show the answer", async ({ page }) => {
  await seed(page, { learners: [learner("l1", "Ravi")], activeLearnerId: "l1" });
  await page.goto("/lesson/?id=cant");
  await expect(page.getByRole("heading", { name: "Who can’t?" })).toBeVisible();
  await page.getByRole("button", { name: "Open the book" }).click();

  await readPages(page, { pages: 1 });
  // Page 2: wrong, wrong → the circle goes around the answer and the narrator explains.
  const sheet = page.locator('[data-page="2"]');
  await expect(sheet).toHaveCount(1);
  const answer = answerFor((await sheet.getAttribute("data-question"))!)!;
  const other = sheet.locator(`button.char-card:not([data-character="${answer}"])`);
  await other.click();
  await expect(sheet.locator(".rough-circle")).toBeHidden();
  await other.click();
  const card = sheet.locator(`button.char-card[data-character="${answer}"]`);
  await expect(card).toHaveAttribute("data-state", "answer");
  await expect(card.locator(".rough-circle")).toBeVisible();
  await expect(card.getByText("can’t", { exact: true })).toBeVisible();
  await expect(sheet.locator("p").first()).toContainText(`The ${answer} can’t`);
  await sheet.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator('[data-page="3"]')).toHaveCount(1);

  const t = (await stored(page)).sessions[0].trials;
  expect(t.map((r) => [r.correct, r.correction])).toEqual([
    [true, false],
    [false, false],
    [false, true],
  ]);
});

test("Voice speed: the snail/rabbit button cycles Slower → Normal → Faster and is saved for the child", async ({ page }) => {
  await seed(page, { learners: [learner("l1", "Mira")], activeLearnerId: "l1" });
  await page.goto("/lesson/?id=can");
  const speed = page.getByTestId("speed");
  await expect(speed).toHaveAccessibleName("Voice speed: Normal");
  await speed.click();
  await expect(speed).toHaveAccessibleName("Voice speed: Faster");
  await speed.click();
  await expect(speed).toHaveAccessibleName("Voice speed: Slower");
  expect((await stored(page)).learners[0].settings.voiceRate).toBe(0.8);
  await page.reload();
  await expect(page.getByTestId("speed")).toHaveAccessibleName("Voice speed: Slower");
});

test("Home in the middle of a book keeps what was answered", async ({ page }) => {
  await seed(page, { learners: [learner("l1", "Mira")], activeLearnerId: "l1" });
  await page.goto("/lesson/?id=can");
  await page.getByRole("button", { name: "Open the book" }).click();
  await readPages(page, { pages: 2 });
  await page.getByRole("button", { name: "Home" }).click();
  await expect(page.getByRole("link", { name: /Open Can: Keep going|Open Can: New/ })).toBeVisible();
  const s = (await stored(page)).sessions[0];
  expect(s.completed).toBe(false);
  expect(s.endedAt).not.toBeNull();
  expect(s.trials).toHaveLength(2);
});

test("Hidden pages never reach a child", async ({ page }) => {
  const lessons = defaultLessons();
  lessons[0].items = lessons[0].items.map((i, k) => (k < 2 ? i : { ...i, status: "draft" as const }));
  await seed(page, { learners: [learner("l1", "Mira")], lessons, activeLearnerId: "l1" });
  await page.goto("/lesson/?id=can");
  await page.getByRole("button", { name: "Open the book" }).click();
  await readPages(page, { pages: 4 });
  const seen = new Set((await stored(page)).sessions[0].trials.map((t) => t.itemId));
  expect([...seen].sort()).toEqual(["dccd-01", "dccd-02"]);
});

test("Read again after 7 days: 5 quiz pages; a failed review sets needs-practice", async ({ page }) => {
  const DAY = 86_400_000;
  const l = learner("l1", "Mira", {}, {
    stickers: ["can"],
    progress: {
      can: {
        delayStep: 0,
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
  await page.getByRole("link", { name: /Open Can: Read again/ }).click();
  await page.getByRole("button", { name: "Open the book" }).click();
  await expect(page.locator('[data-page="1"]')).toHaveAttribute("data-step", "review");
  await readPages(page, { pages: 5, wrongOn: [1, 2, 3] });
  await expect(page.getByText("The end", { exact: true })).toBeVisible();
  const s = await stored(page);
  expect(s.sessions[0].kind).toBe("review");
  expect(s.sessions[0].trials).toHaveLength(5);
  expect(s.learners[0].progress.can).toMatchObject({ needsPractice: true, masteredAt: null });
  await page.getByRole("button", { name: "Back to my books" }).click();
  await expect(page.getByRole("link", { name: /Open Can: Keep going/ })).toBeVisible();
});
