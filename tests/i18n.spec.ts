import { expect, test } from "@playwright/test";

/**
 * G5: language versions. English without a prefix, Czech under /cs, the switcher
 * leads to the same page in the other language and links stay in the page language.
 */
test.describe("language versions", () => {
  test("Czech version has Czech menu, lang and prefixed links", async ({ page }) => {
    await page.goto("/cs/about");
    await expect(page.locator('[lang="cs"]').first()).toBeAttached();
    const nav = page.getByRole("navigation", { name: "Hlavní" });
    await expect(nav.getByRole("link", { name: "O Atlasu" })).toHaveAttribute("href", "/cs/about");
    await expect(nav.getByRole("link", { name: "Novinky" })).toHaveAttribute("href", "/cs/news");
  });

  test("language switcher leads to the same page", async ({ page, isMobile }) => {
    // On mobile the switcher is in the menu behind the hamburger.
    const openMenu = async (label: string) => {
      if (isMobile) await page.getByRole("button", { name: label }).click();
    };
    await page.goto("/country/ukraine");
    await openMenu("Open menu");
    await page.getByRole("link", { name: "Switch to Čeština" }).locator("visible=true").click();
    await expect(page).toHaveURL(/\/cs\/country\/ukraine$/);
    await openMenu("Otevřít menu");
    await page.getByRole("link", { name: "Přepnout na English" }).locator("visible=true").click();
    await expect(page).toHaveURL(/\/country\/ukraine$/);
  });

  test("/en/… redirects to the canonical URL without a prefix", async ({ request }) => {
    const response = await request.get("/en/about", { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toMatch(/\/about$/);
  });

  test("page carries hreflang for both versions", async ({ page }) => {
    await page.goto("/cs/country/ukraine");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/cs\/country\/ukraine$/,
    );
    await expect(page.locator('link[hreflang="en"]')).toHaveAttribute(
      "href",
      /\/country\/ukraine$/,
    );
  });
});

/**
 * G5.3–G5.6: the public site in Czech — portrait, untranslated article, list,
 * search and the 404 page. Data come from the seed (atlas-dev).
 */
test.describe("Czech public site", () => {
  test("region portrait: Czech name, sections and prefixed country links", async ({ page }) => {
    await page.goto("/cs/region/east-asia");
    await expect(page.getByRole("heading", { level: 1, name: "Východní Asie" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Encyklopedická hesla" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Země tohoto regionu" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Japonsko", exact: true })).toHaveAttribute(
      "href",
      "/cs/country/japan",
    );
  });

  test("untranslated news: original with a note, lang en, canonical URL of the original", async ({
    page,
  }) => {
    await page.goto("/cs/news/nordic-model-under-strain");
    await expect(page.getByRole("note")).toContainText("Tento text zatím není přeložený");
    await expect(page.locator('article[lang="en"]')).toBeAttached();
    await expect(page.getByText(/\d+ min čtení/).first()).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/news\/nordic-model-under-strain$/,
    );
    // hreflang only for languages the article actually exists in.
    await expect(page.locator('link[hreflang="cs"]')).toHaveCount(0);
    await expect(page.locator('link[hreflang="en"]')).toHaveCount(1);
  });

  test("news list links to Czech article URLs", async ({ page }) => {
    await page.goto("/cs/news");
    const article = page.locator('a[href^="/cs/news/"]').first();
    await expect(article).toBeVisible();
    await expect(page.locator('main a[href^="/news/"]')).toHaveCount(0);
  });

  test("search returns links in the page language", async ({ page }) => {
    await page.goto("/cs/search?q=Japan");
    await expect(page.locator('main a[href="/cs/country/japan"]').first()).toBeVisible();
  });

  test("non-existent entry returns 404", async ({ request }) => {
    const response = await request.get("/cs/entry/tohle-heslo-neexistuje");
    expect(response.status()).toBe(404);
  });

  test("404 offers the outline quiz (English only for now)", async ({ page }) => {
    await page.goto("/cs/news/tohle-neexistuje");
    await page.getByRole("button", { name: "Play the outline quiz" }).click();
    await expect(page.getByRole("heading", { name: "Which country is this?" })).toBeFocused();
    await expect(page.getByRole("group", { name: "Choices" }).getByRole("button")).toHaveCount(4);
  });
});
