import type { Page } from "@playwright/test";
import { answerTrials, expect, learner, seed, test } from "./helpers";

/** Real device sizes for each width in the brief, portrait and landscape. */
const DEVICES: { w: number; portrait: [number, number]; landscape: [number, number] }[] = [
  { w: 320, portrait: [320, 568], landscape: [568, 320] },
  { w: 390, portrait: [390, 844], landscape: [844, 390] },
  { w: 768, portrait: [768, 1024], landscape: [1024, 768] },
  { w: 1024, portrait: [1024, 1366], landscape: [1366, 1024] },
  { w: 1440, portrait: [900, 1440], landscape: [1440, 900] },
  { w: 1920, portrait: [1080, 1920], landscape: [1920, 1080] },
];
const SCREENS = process.env.SCREENS ?? "test-results/screens";

async function noOverflow(page: Page, what: string) {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  expect(o.sw, `${what}: horizontal scroll`).toBeLessThanOrEqual(o.w);
}

async function onScreen(page: Page, size: { width: number; height: number }, names: string[]) {
  for (const name of names) {
    const loc = name === "cards" ? page.locator("button.char-card") : name === "tokens" ? page.getByRole("group", { name: /^First:/ }) : name === "schedule" ? page.getByRole("navigation", { name: "Lesson steps" }) : page.getByRole("button", { name, exact: true });
    for (const el of await loc.all()) {
      const b = (await el.boundingBox())!;
      expect(b.y + b.height, `${name} inside the viewport`).toBeLessThanOrEqual(size.height + 1);
      expect(b.x + b.width, `${name} inside the viewport`).toBeLessThanOrEqual(size.width + 1);
      // Watch controls on short landscape phones are a stacked icon column (see README → Limits); they only need to be on screen.
      const shortLandscape = size.height < 560 && size.width > size.height && ["Back", "Replay", "Next"].includes(name);
      if (name !== "schedule" && name !== "tokens" && !shortLandscape) expect(Math.min(b.width, b.height), `${name} tap target`).toBeGreaterThanOrEqual(80);
    }
  }
}

for (const d of DEVICES) {
  for (const orientation of ["portrait", "landscape"] as const) {
    const [width, height] = d[orientation];
    const size = { width, height };
    const tag = `${d.w}-${orientation}-${width}x${height}`;
    test(`no layout breaks at ${d.w} ${orientation} (${width}×${height})`, async ({ page }) => {
      await page.setViewportSize(size);
      await seed(page, { learners: [learner("l1", "Mira", { tokenBoardSize: 10 })], activeLearnerId: "l1" });
      await page.goto("/");
      await expect(page.getByRole("link", { name: /Open Can/ }).first()).toBeVisible();
      await noOverflow(page, "home");
      await page.waitForTimeout(900); // lesson cards fade in one after another
      await page.screenshot({ path: `${SCREENS}/${tag}-1-home.png` });

      await page.goto("/lesson/?id=can");
      await expect(page.getByRole("button", { name: "Bubbles" })).toBeVisible();
      await onScreen(page, size, ["Bubbles", "Star garden", "Swimming fish", "Break", "Mute"]);
      await page.waitForTimeout(900); // the three choices fade in one after another
      // No reward label spills out of its button into the next one.
      for (const btn of await page.locator(".reward-grid button").all()) {
        const fits = await btn.evaluate((b) => [...b.querySelectorAll("span")].every((s) => {
          const r = s.getBoundingClientRect();
          const o = b.getBoundingClientRect();
          return r.left >= o.left - 1 && r.right <= o.right + 1;
        }));
        expect(fits, "reward label inside its button").toBe(true);
      }
      await page.screenshot({ path: `${SCREENS}/${tag}-2-choose.png` });
      await page.getByRole("button", { name: "Bubbles" }).click();
      await expect(page.locator(".a-cards [role=img]")).toHaveCount(2);
      await page.waitForTimeout(600);
      await noOverflow(page, "watch");
      await onScreen(page, size, ["schedule", "tokens", "Break", "Mute", "Back", "Replay", "Next"]);
      const watchCards = page.locator(".a-cards [role=img]");
      const promptBox = (await page.locator(".a-prompt").first().boundingBox())!;
      for (const el of await watchCards.all()) {
        const b = (await el.boundingBox())!;
        expect(promptBox.y + promptBox.height, "teach line ends above the cards").toBeLessThanOrEqual(b.y + 1);
        expect(b.width, "watch card width").toBeGreaterThanOrEqual(96);
        expect(b.y + b.height, "watch card inside the viewport").toBeLessThanOrEqual(height + 1);
      }
      await page.screenshot({ path: `${SCREENS}/${tag}-3-watch.png` });

      await page.goto("/lesson/?id=can&step=practise");
      await page.getByRole("button", { name: "Bubbles" }).click();
      await expect(page.locator('button.char-card[data-state="prompted"]')).toHaveCount(1);
      await page.waitForTimeout(700);
      await noOverflow(page, "practise");
      // The schedule, token board, Break card and both cards stay on one screen with no scrolling.
      await onScreen(page, size, ["schedule", "tokens", "cards", "Break", "Mute"]);
      await page.screenshot({ path: `${SCREENS}/${tag}-4-practise.png` });
      await answerTrials(page, { trials: 1 });

      await page.goto("/grown-up/?tab=backup");
      await page.getByRole("button", { name: "Load demo data" }).click();
      await page.getByRole("tab", { name: "Progress" }).click();
      await page.getByLabel("Learner").selectOption({ label: "Kabir" });
      await expect(page.getByTestId("bias-panel")).toBeVisible();
      await noOverflow(page, "grown-up");
      await page.screenshot({ path: `${SCREENS}/${tag}-5-progress.png`, fullPage: true });
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
