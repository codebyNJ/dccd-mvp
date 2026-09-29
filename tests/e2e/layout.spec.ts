import { answerTrials, expect, learner, seed, test } from "./helpers";

const WIDTHS = [320, 390, 768, 1024, 1440, 1920];
const heightFor = (w: number) => Math.round(w * (w < 768 ? 2.1 : 1.35));

async function noOverflow(page: import("@playwright/test").Page, what: string) {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  expect(o.sw, `${what}: horizontal scroll`).toBeLessThanOrEqual(o.w);
}

for (const w of WIDTHS) {
  for (const orientation of ["portrait", "landscape"] as const) {
    const size = orientation === "portrait" ? { width: w, height: heightFor(w) } : { width: heightFor(w), height: w };
    test(`no layout breaks at ${w} ${orientation}`, async ({ page }) => {
      await page.setViewportSize(size);
      await seed(page, { learners: [learner("l1", "Mira", { tokenBoardSize: 10 })], activeLearnerId: "l1" });
      await page.goto("/");
      await expect(page.getByRole("link", { name: /Open Can/ }).first()).toBeVisible();
      await noOverflow(page, "home");

      await page.goto("/lesson/?id=can&step=practise");
      await page.getByRole("button", { name: "Bubbles" }).click();
      await expect(page.locator("button.char-card")).toHaveCount(2);
      await noOverflow(page, "lesson");
      // Everything the child needs stays on one screen: both cards, Break, Mute and the token board.
      for (const loc of [page.locator("button.char-card").first(), page.locator("button.char-card").last(), page.getByRole("button", { name: "Break" }), page.getByRole("button", { name: "Mute" })]) {
        const b = (await loc.boundingBox())!;
        expect(b.y + b.height, "inside the viewport").toBeLessThanOrEqual(size.height + 1);
        expect(b.x + b.width).toBeLessThanOrEqual(size.width + 1);
        expect(Math.min(b.width, b.height), "tap target").toBeGreaterThanOrEqual(80);
      }
      await answerTrials(page, { trials: 1 });

      await page.goto("/grown-up/?tab=learners");
      await expect(page.getByRole("heading", { name: "Mira" })).toBeVisible();
      await noOverflow(page, "grown-up");
    });
  }
}

test("Calm mode: motion is reduced (no idle loops) and mute stays on across lessons", async ({ page }) => {
  await seed(page, { learners: [learner("l1", "Mira", { calmMode: true })], activeLearnerId: "l1" });
  await page.goto("/lesson/?id=can&step=practise");
  await page.getByRole("button", { name: "Mute" }).click();
  await expect(page.getByRole("button", { name: "Mute" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Bubbles" }).click();
  await expect(page.locator("button.char-card")).toHaveCount(2);
  // No GSAP idle transform on the card art in calm mode.
  await page.waitForTimeout(400);
  const transforms = await page.locator("button.char-card > div").evaluateAll((els) => els.map((e) => (e as HTMLElement).style.transform));
  expect(transforms.every((t) => t === "" || t === "none" || /translate\(0px, 0px\)|matrix\(1, 0, 0, 1, 0, 0\)/.test(t))).toBe(true);
  await page.goto("/lesson/?id=can");
  await expect(page.getByRole("button", { name: "Mute" })).toHaveAttribute("aria-pressed", "true");
});

for (const reduce of [false, true]) {
  test(`Idle loops ${reduce ? "stop when the OS asks for reduced motion" : "run with calm mode off"}`, async ({ page }) => {
    if (reduce) await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page, { learners: [learner("l1", "Mira", { calmMode: false })], activeLearnerId: "l1" });
    await page.goto("/lesson/?id=can&step=practise");
    await page.getByRole("button", { name: "Bubbles" }).click();
    await expect(page.locator("button.char-card")).toHaveCount(2);
    await page.waitForTimeout(1200);
    const moving = await page
      .locator("button.char-card > div")
      .evaluateAll((els) => els.some((e) => /translate|rotate|scale|matrix/.test((e as HTMLElement).style.transform) && !/translate\(0px, 0px\)$/.test((e as HTMLElement).style.transform)));
    expect(moving).toBe(!reduce);
  });
}
