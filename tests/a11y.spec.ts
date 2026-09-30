import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

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
];

for (const path of PAGES) {
  test(`přístupnost: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude(".maplibregl-canvas-container")
      .analyze();
    const serious = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(
      serious.map(
        (v) =>
          `${v.id}: ${v.nodes
            .map((n) => n.target.join(" "))
            .slice(0, 3)
            .join(", ")}`,
      ),
    ).toEqual([]);
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
