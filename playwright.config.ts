import { defineConfig, devices } from "@playwright/test";

/**
 * Průchody aplikací v prohlížeči.
 *
 * Rychlé kontroly obsahu dělá `npm run test:smoke` bez prohlížeče; sem patří
 * to, co se bez něj ověřit nedá – klikání, klávesnice, mobilní menu a velikost
 * dotykových cílů.
 *
 * Jede proti produkčnímu buildu (npm run build && npm run start): vývojový
 * server překládá routy až při prvním otevření a testy pak padají na čekání,
 * ne na chybu.
 */
export default defineConfig({
  testDir: "./tests",
  // tests/unit patří Vitestu.
  testMatch: "**/*.spec.ts",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  // Každý test si otevírá globus na WebGL; víc běhů najednou slabší stroj
  // nezvládá a testy pak padají na čekání, ne na chybu.
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
