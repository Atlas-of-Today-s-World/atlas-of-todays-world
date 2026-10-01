import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Automatická kontrola přístupnosti (F8, WCAG 2.1 AA) na hlavních typech
 * stránek. Plátno globusu (WebGL) axe neumí posoudit — vynechává se; jeho
 * obsah je dostupný i jinak (hledání, tabulky vrstev, seznam pro čtečky).
 */
const PAGES = [
  "/",
  "/country/ukraine",
  "/region/eastern-europe-central-asia",
  "/global-issue/russia-ukraine-war",
  "/view/hdi",
  "/news",
  "/about",
  "/privacy",
  "/accessibility",
  "/login",
  "/news/nordic-model-under-strain",
  "/search?q=Japan",
  // Česká verze (G5): jiné texty i jiná délka popisků — vlastní kontrola.
  "/cs",
  "/cs/country/ukraine",
  "/cs/region/east-asia",
  "/cs/global-issue/russia-ukraine-war",
  "/cs/news",
  "/cs/news/nordic-model-under-strain",
  "/cs/about",
  "/cs/search?q=Japan",
  "/cs/login",
  // Stránka 404 v mapě i mimo ni.
  "/news/this-does-not-exist",
  "/this-page-does-not-exist",
];

/** Vážná a kritická porušení WCAG 2.1 AA (plátno globusu axe neumí posoudit). */
async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude(".maplibregl-canvas-container")
    .analyze();
  return results.violations
    .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
    .map(
      (v) =>
        `${v.id}: ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(", ")}`,
    );
}

test("přístupnost: kvíz na stránce 404 během hry", async ({ page }) => {
  await page.goto("/cs/news/tohle-neexistuje");
  await page.getByRole("button", { name: "Play the outline quiz" }).click();
  await expect(page.getByRole("heading", { name: "Which country is this?" })).toBeVisible();
  await page.getByRole("group", { name: "Choices" }).getByRole("button").first().click();
  expect(await seriousViolations(page)).toEqual([]);
});

for (const path of PAGES) {
  test(`přístupnost: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await seriousViolations(page)).toEqual([]);
  });
}

// Na mapových stránkách si fokus bere rovnou panel s obsahem; skip-link je
// pro stránky, kde je nejdřív menu.
test("skip-link vede k obsahu", async ({ page, isMobile }) => {
  test.skip(isMobile, "klávesnice");
  await page.goto("/about");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#content$/);
});
