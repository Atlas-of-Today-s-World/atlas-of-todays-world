import { defineConfig, devices } from "@playwright/test";

/**
 * In-browser walkthroughs of the app.
 *
 * Quick content checks run in `npm run test:smoke` without a browser; this is
 * for what can't be verified without one – clicks, keyboard, mobile menu and
 * touch target size.
 *
 * Runs against the production build (npm run build && npm run start): the dev
 * server compiles routes only on first visit and tests then time out waiting,
 * ne na chybu.
 */
export default defineConfig({
  testDir: "./tests",
  // tests/unit belongs to Vitest.
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  // In CI the globe runs on software WebGL; one slow run shouldn't fail the build.
  retries: process.env.CI ? 2 : 0,
  expect: { timeout: 10_000 },
  // Every test opens the WebGL globe; a weaker machine can't handle more runs
  // at once, and tests then fail on timeouts, not on real errors.
  fullyParallel: false,
  workers: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
