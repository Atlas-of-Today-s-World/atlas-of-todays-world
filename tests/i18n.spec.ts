import { expect, test } from "@playwright/test";

/**
 * The site is English only (2026-10-05). The former Czech version under /cs
 * redirects permanently to the English page, so links from search engines and
 * shares keep working.
 */
test.describe("English only", () => {
  test("former Czech URLs redirect permanently to the English page", async ({ request }) => {
    for (const [from, to] of [
      ["/cs", /\/$/],
      ["/cs/about", /\/about$/],
      ["/cs/country/ukraine", /\/country\/ukraine$/],
      ["/cs/news/nordic-model-under-strain?x=1", /\/news\/nordic-model-under-strain\?x=1$/],
    ] as const) {
      const response = await request.get(from, { maxRedirects: 0 });
      expect(response.status(), from).toBe(308);
      expect(response.headers().location, from).toMatch(to);
    }
  });

  test("/en/… redirects to the canonical URL without a prefix", async ({ request }) => {
    const response = await request.get("/en/about", { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toMatch(/\/about$/);
  });

  test("pages are English, without a language switcher or Czech hreflang", async ({ page }) => {
    await page.goto("/country/ukraine");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("group", { name: "Language" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Switch to/ })).toHaveCount(0);
    await expect(page.locator('link[hreflang="cs"]')).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/country\/ukraine$/,
    );
  });
});
