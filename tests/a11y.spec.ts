import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Automated accessibility check (F8, WCAG 2.1 AA) on the main page types.
 * axe cannot assess the globe canvas (WebGL), so it is excluded; its content
 * is available in other ways too (search, layer tables, the /countries list).
 */
const PAGES = [
  "/",
  "/countries",
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
  "/membership",
  "/membership/checkout?period=monthly&amount=10",
  "/membership/thank-you?period=one-time&amount=50",
  "/membership/manage",
  // The 404 page both inside and outside the map.
  "/news/this-does-not-exist",
  "/this-page-does-not-exist",
];

/** Serious and critical WCAG 2.1 AA violations (axe cannot assess the globe canvas). */
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

test("accessibility: quiz on the 404 page during a game", async ({ page }) => {
  await page.goto("/news/this-does-not-exist");
  await page.getByRole("button", { name: "Play the outline quiz" }).click();
  await expect(page.getByRole("heading", { name: "Which country is this?" })).toBeVisible();
  await page.getByRole("group", { name: "Choices" }).getByRole("button").first().click();
  expect(await seriousViolations(page)).toEqual([]);
});

for (const path of PAGES) {
  test(`accessibility: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await seriousViolations(page)).toEqual([]);
  });
}

// On map pages the content panel takes focus directly; the skip link is for
// pages where the menu comes first.
test("skip-link vede k obsahu", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard");
  await page.goto("/about");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#content$/);
});

// The sign-up form is on /newsletter twice once the mobile menu is open; its
// ids come from useId, so each e-mail field keeps its own label and errors.
test("/newsletter: both sign-up forms have their own e-mail field ids", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/newsletter");
  const emails = page.locator('input[name="email"]');
  test.skip((await emails.count()) === 0, "the newsletter flag is off");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
  await expect(emails).toHaveCount(2);

  const ids = await emails.evaluateAll((inputs) => inputs.map((input) => input.id));
  expect(new Set(ids).size).toBe(2);
  const duplicates = await page.evaluate(() => {
    const all = [...document.querySelectorAll("[id]")].map((node) => node.id);
    return all.filter((id, index) => all.indexOf(id) !== index);
  });
  expect(duplicates).toEqual([]);
});
