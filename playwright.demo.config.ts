import { defineConfig, devices } from "@playwright/test";

/**
 * Testy sdílené ukázky (demo/atlas.html) — administrace, nastavení, role
 * a mobilní rozvržení. Běží proti sestavenému souboru, bez serveru:
 * `npm run test:demo` ho napřed sestaví.
 *
 * Každý test má čistý prohlížeč (vlastní localStorage), takže pořadí testů
 * na výsledku nezáleží.
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
