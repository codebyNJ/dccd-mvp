import { defineConfig, devices } from "@playwright/test";

const port = 3100;
// Use a pre-installed Chromium when the bundled one isn't downloaded (e.g. cloud sandboxes).
const chromiumPath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: chromiumPath ? { executablePath: chromiumPath } : {} } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: `node scripts/serve-out.mjs`,
    port,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(port) },
  },
});
