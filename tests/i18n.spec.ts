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
