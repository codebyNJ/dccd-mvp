// Put the layout test's screenshots side by side, one sheet per screen, for a quick visual review.
//   npm run test:e2e -- tests/e2e/layout.spec.ts && node scripts/contact-sheet.mjs
// Writes test-results/sheet-<screen>.png. Set PW_CHROMIUM_PATH to use an installed Chromium.
import { chromium } from "@playwright/test";
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = join(process.cwd(), "test-results");
const dir = join(out, "screens");
const files = readdirSync(dir).sort();
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
for (const step of ["1-home", "2-choose", "3-watch", "4-practise", "5-progress"]) {
  const shots = files.filter((f) => f.includes(step));
  const html = `<body style="margin:0;background:#333;display:flex;flex-wrap:wrap;gap:8px;padding:8px;align-items:flex-start">${shots
    .map((f) => `<figure style="margin:0;color:#fff;font:12px sans-serif"><img src="screens/${f}" style="height:${step === "5-progress" ? 520 : 300}px;display:block"><figcaption>${f}</figcaption></figure>`)
    .join("")}</body>`;
  const page = join(out, `sheet-${step}.html`);
  writeFileSync(page, html);
  const p = await browser.newPage({ viewport: { width: 1800, height: 800 } });
  await p.goto(`file://${page}`);
  await p.waitForLoadState("load");
  await p.screenshot({ path: join(out, `sheet-${step}.png`), fullPage: true });
  await p.close();
}
await browser.close();
console.log(`Sheets written to ${out}`);
