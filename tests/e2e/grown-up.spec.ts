import { readFile } from "node:fs/promises";
import { expect, learner, seed, stored, test } from "./helpers";

test("Grown-ups link, add a child in two steps, pick them on the first page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Ask a grown-up to add a reader.")).toBeVisible();
  await page.getByRole("link", { name: "Grown-ups" }).click();
  await expect(page).toHaveURL(/grown-up/);

  await page.getByRole("button", { name: "Add a child" }).click();
  await page.getByLabel("Nickname").fill("Tara");
  // Tap the picture, as a person would (the radio itself is visually hidden).
  await page.locator("label", { has: page.getByRole("radio", { name: "kite" }) }).click();
  await expect(page.getByRole("radio", { name: "kite" })).toBeChecked();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Tara" })).toBeVisible();
  expect((await stored(page)).learners[0].avatar).toBe("kite");
  // Settings stay folded away until asked for.
  await expect(page.getByLabel("Voice speed")).toBeHidden();

  await page.getByRole("link", { name: "Back to child view" }).click();
  await page.getByRole("button", { name: "Tara" }).click();
  await expect(page.getByRole("link", { name: /Open Can: New/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open Can’t: New/ })).toBeVisible();
});

test("More settings: voice speed and books on the shelf", async ({ page }) => {
  await seed(page, { learners: [learner("l1", "Mira")], activeLearnerId: "l1" });
  await page.goto("/grown-up/");
  await page.getByText("More settings").click();
  await page.getByLabel("Voice speed").selectOption({ label: "Slower" });
  await page.getByRole("checkbox", { name: "Can", exact: true }).uncheck();
  expect((await stored(page)).learners[0].settings.voiceRate).toBe(0.8);
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Open Can’t: New/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open Can:/ })).toHaveCount(0);
});

test("Page maker: type the action, tap two pictures, tap who can’t; the page reaches the child", async ({ page }) => {
  await seed(page, { learners: [learner("l1", "Mira")], activeLearnerId: "l1" });
  await page.goto("/grown-up/?tab=lessons");
  await page.getByRole("button", { name: "Who can’t?" }).click();
  await expect(page.getByTestId("item-row")).toHaveCount(10);
  await page.getByRole("button", { name: "New page" }).click();

  const save = page.getByRole("button", { name: "Save page" });
  await expect(save).toBeDisabled();
  await page.getByLabel("1. What is the action?").fill("hop");
  await expect(page.getByTestId("page-preview")).toContainText("Who can’t hop?");
  await expect(page.getByText("Pick two pictures first.")).toBeVisible();
  await page.getByRole("button", { name: "bird", exact: true }).click();
  await page.getByRole("button", { name: "snake", exact: true }).click();
  await expect(save).toBeDisabled();
  await page.getByRole("button", { name: "snake can’t" }).click();
  await expect(page.getByTestId("page-preview").locator(".rough-circle")).toHaveCount(1);
  await save.click();

  await expect(page.getByTestId("item-row")).toHaveCount(11);
  await expect(page.getByRole("button", { name: "Edit the page “hop”" })).toContainText("Who can’t hop?");
  const cant = (await stored(page)).lessons.find((l) => l.id === "cant")!;
  expect(cant.items.at(-1)).toMatchObject({ verb: "hop", optionA: "bird", optionB: "snake", answer: "snake", status: "approved" });

  // Edit it: hide it from children.
  await page.getByRole("button", { name: "Edit the page “hop”" }).click();
  await page.getByLabel("Show this page to children").uncheck();
  await page.getByRole("button", { name: "Save page" }).click();
  await expect(page.getByTestId("item-row").filter({ hasText: "hop" })).toContainText("Hidden");

  await page.getByRole("button", { name: "Delete the page “hop”" }).click();
  await expect(page.getByTestId("item-row")).toHaveCount(10);
});

test("Demo data: position-bias flag, plain summary and print report", async ({ page }) => {
  await page.goto("/grown-up/?tab=backup");
  await page.getByRole("button", { name: "Load demo data" }).click();
  await expect(page.getByText("Demo data loaded.")).toBeVisible();

  await page.getByRole("tab", { name: "Progress" }).click();
  await page.getByLabel("Child").selectOption({ label: "Kabir" });
  await expect(page.getByTestId("bias-panel")).toContainText(/Flag: \d+% of taps on the right/);

  await page.getByLabel("Child").selectOption({ label: "Asha" });
  await expect(page.getByTestId("bias-panel")).toContainText("No side bias.");
  await page.getByLabel("Book", { exact: true }).selectOption({ label: "Can’t" });
  await expect(page.getByTestId("plain-summary")).toContainText("the lion questions");
  await expect(page.getByTestId("plain-summary")).toContainText("who can’t roar");

  // Print: only the report shows.
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("heading", { name: "Progress report: Asha" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Progress" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await expect(page.getByRole("heading", { name: "Progress report: Asha" })).toBeHidden();

  // As in DEMO_SCRIPT.md: Asha's Can is mastered and due for review, Can't is in progress.
  await page.getByRole("link", { name: "Back to child view" }).click();
  await page.getByRole("button", { name: "Asha" }).click();
  await expect(page.getByRole("link", { name: /Open Can: Read again/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open Can’t: Keep going/ })).toBeVisible();
  await expect(page.getByRole("img", { name: "Can" })).toBeVisible();
});

test("CSV import validates rows; Reset to DCCD deck restores the 10 items", async ({ page }) => {
  await page.goto("/grown-up/?tab=lessons");
  await expect(page.getByTestId("item-row")).toHaveCount(10);
  await page.getByText("Import from a sheet").click();
  await page.getByLabel("Paste CSV").fill(
    ["verb,optionA,optionB,answer,status", "hop,bird,snake,snake,approved", "moo,cow,dog,dog,approved", "run,dog,dog,dog,draft", "purr,cat,dog,dog,"].join("\n"),
  );
  await page.getByRole("button", { name: "Check rows" }).click();
  await expect(page.getByText("2 valid rows")).toBeVisible();
  await expect(page.getByText("2 rows have errors and will be skipped")).toBeVisible();
  await expect(page.getByTestId("csv-errors")).toContainText('Unknown image "cow"');
  await expect(page.getByTestId("csv-errors")).toContainText("optionA and optionB are the same character.");
  await page.getByRole("button", { name: "Add 2 pages to Can" }).click();
  await expect(page.getByText("Imported 2 pages.")).toBeVisible();
  await expect(page.getByTestId("item-row")).toHaveCount(12);
  // The status-less row came in hidden.
  await expect(page.getByTestId("item-row").filter({ hasText: "purr" })).toContainText("Hidden");

  // Header errors are reported, not guessed.
  await page.getByLabel("Paste CSV").fill("word,a,b\nswim,baby,swimmer");
  await page.getByRole("button", { name: "Check rows" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Missing: verb, optionA, optionB, answer" })).toBeVisible();

  await page.getByRole("button", { name: "Reset to DCCD deck" }).click();
  await expect(page.getByTestId("item-row")).toHaveCount(10);
});

test("Export, clear, then import the backup restores everything", async ({ page }) => {
  await seed(page, { learners: [learner("l1", "Mira")], activeLearnerId: "l1" });
  await page.goto("/grown-up/?tab=backup");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export all data (JSON)" }).click()]);
  const file = await download.path();
  const json = JSON.parse(await readFile(file, "utf8"));
  expect(json.app).toBe("dccd-learning-studio");
  expect(json.state.learners[0].nickname).toBe("Mira");

  await page.getByRole("button", { name: "Clear all data" }).click();
  await expect(page.getByText("All data cleared.")).toBeVisible();
  expect((await stored(page)).learners).toHaveLength(0);

  await page.getByTestId("backup-import").setInputFiles(file);
  await expect(page.getByText("Backup imported.")).toBeVisible();
  expect((await stored(page)).learners[0].nickname).toBe("Mira");

  // A bad file is rejected with a reason and changes nothing.
  await page.getByTestId("backup-import").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from('{"learners": 5}') });
  await expect(page.getByRole("alert").filter({ hasText: "That file isn’t a valid backup" })).toBeVisible();
  expect((await stored(page)).learners[0].nickname).toBe("Mira");
});
