import { expect, test } from "@playwright/test";

/**
 * G5: jazykové verze. Angličtina bez předpony, čeština pod /cs, přepínač vede
 * na stejnou stránku v druhém jazyce a odkazy zůstávají v jazyce stránky.
 */
test.describe("jazykové verze", () => {
  test("česká verze má české menu, lang a odkazy s předponou", async ({ page }) => {
    await page.goto("/cs/about");
    await expect(page.locator('[lang="cs"]').first()).toBeAttached();
    const nav = page.getByRole("navigation", { name: "Hlavní" });
    await expect(nav.getByRole("link", { name: "O Atlasu" })).toHaveAttribute("href", "/cs/about");
    await expect(nav.getByRole("link", { name: "Novinky" })).toHaveAttribute("href", "/cs/news");
  });

  test("přepínač jazyka vede na tutéž stránku", async ({ page, isMobile }) => {
    // Na mobilu je přepínač v menu za hamburgerem.
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

  test("/en/… přesměruje na kanonickou adresu bez předpony", async ({ request }) => {
    const response = await request.get("/en/about", { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toMatch(/\/about$/);
  });

  test("stránka nese hreflang pro obě verze", async ({ page }) => {
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
 * G5.3–G5.6: veřejná část v češtině — portrét, článek bez překladu, seznam,
 * hledání a stránka 404. Data jsou ze seedu (atlas-dev).
 */
test.describe("česká veřejná část", () => {
  test("portrét regionu: český název, sekce a odkazy na země s předponou", async ({ page }) => {
    await page.goto("/cs/region/east-asia");
    await expect(page.getByRole("heading", { level: 1, name: "Východní Asie" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Encyklopedická hesla" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Země tohoto regionu" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Japonsko", exact: true })).toHaveAttribute(
      "href",
      "/cs/country/japan",
    );
  });

  test("novinka bez překladu: originál s poznámkou, lang en, kanonická adresa originálu", async ({
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
    // hreflang jen pro jazyky, ve kterých článek opravdu je.
    await expect(page.locator('link[hreflang="cs"]')).toHaveCount(0);
    await expect(page.locator('link[hreflang="en"]')).toHaveCount(1);
  });

  test("seznam novinek vede na české adresy článků", async ({ page }) => {
    await page.goto("/cs/news");
    const article = page.locator('a[href^="/cs/news/"]').first();
    await expect(article).toBeVisible();
    await expect(page.locator('main a[href^="/news/"]')).toHaveCount(0);
  });

  test("hledání vrací odkazy v jazyce stránky", async ({ page }) => {
    await page.goto("/cs/search?q=Japan");
    await expect(page.locator('main a[href="/cs/country/japan"]').first()).toBeVisible();
  });

  test("neexistující heslo vrátí 404", async ({ request }) => {
    const response = await request.get("/cs/entry/tohle-heslo-neexistuje");
    expect(response.status()).toBe(404);
  });

  test("404 nabízí kvíz obrysů (zatím jen anglicky)", async ({ page }) => {
    await page.goto("/cs/news/tohle-neexistuje");
    await page.getByRole("button", { name: "Play the outline quiz" }).click();
    await expect(page.getByRole("heading", { name: "Which country is this?" })).toBeFocused();
    await expect(page.getByRole("group", { name: "Choices" }).getByRole("button")).toHaveCount(4);
  });
});
