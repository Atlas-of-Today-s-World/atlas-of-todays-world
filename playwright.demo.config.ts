import { defineConfig, devices } from "@playwright/test";

/**
 * Tests of the shared demo (demo/atlas.html) — admin, settings, roles
 * and mobile layout. They run against the built file, without a server:
 * `npm run test:demo` builds it first.
 *
 * Every test gets a clean browser (its own localStorage), so test order
 * doesn't affect the result.
 */
export default defineConfig({
  testDir: "./demo/tests",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  reporter: [["list"]],
  use: { trace: "retain-on-failure", locale: "en-GB", timezoneId: "Europe/Prague" },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
