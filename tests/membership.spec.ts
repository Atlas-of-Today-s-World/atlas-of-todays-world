import { expect, test, type Page } from "@playwright/test";

/**
 * Atlas Patrons: donation card → DEMO checkout → thank-you page. No real
 * payment exists yet (ADR G6); the demo uses Stripe's public test cards.
 */

async function fillCard(page: Page, number: string) {
  await page.getByLabel("Email").fill("patron@example.org");
  await page.getByLabel("Card number").fill(number);
  await page.getByLabel("Expiry (MM / YY)").fill("12 / 30");
  await page.getByLabel("CVC").fill("123");
  await page.getByLabel("Name on card").fill("Test Patron");
}

test.describe("Atlas Patrons", () => {
  test("one-time €100 → demo checkout with test card → thank-you", async ({ page }) => {
    await page.goto("/membership");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Help Us Build");

    // The card is rendered twice (hero and closing band); use the first one.
    const card = page.locator("main form").first();
    await card.getByText("One-time", { exact: true }).click();
    await expect(card.getByRole("radio", { name: "One-time" })).toBeChecked();
    await card.getByText("€100", { exact: true }).click();
    await expect(card.getByRole("radio", { name: "€100" })).toBeChecked();
    await card.getByRole("button", { name: "Donate & Join" }).click();

    await expect(page).toHaveURL(/\/membership\/checkout\?period=one-time&amount=100$/);
    await expect(page.getByText(/Demo mode — no payment will be taken/)).toBeVisible();
    await fillCard(page, "4242 4242 4242 4242");
    await page.getByRole("button", { name: "Pay €100" }).click();

    await expect(page).toHaveURL(/\/membership\/thank-you\?period=one-time&amount=100$/);
    await expect(page.getByRole("heading", { name: "Welcome to Atlas Patrons!" })).toBeVisible();
    await expect(page.getByText("Thank you for your donation of €100.")).toBeVisible();
  });

  test("the declined test card shows an error and stays on checkout", async ({ page }) => {
    await page.goto("/membership/checkout?period=monthly&amount=10");
    await fillCard(page, "4000 0000 0000 0002");
    await page.getByRole("button", { name: "Subscribe" }).click();
    await expect(page.getByText(/Your card was declined/)).toBeVisible();
    await expect(page.getByLabel("Card number")).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(/\/membership\/checkout/);
  });

  test("an amount that is not offered goes back to /membership", async ({ page }) => {
    await page.goto("/membership/checkout?period=monthly&amount=7");
    await expect(page).toHaveURL(/\/membership$/);
  });

  test("/cs/membership is in Czech", async ({ page }) => {
    await page.goto("/cs/membership");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Pomozte nám budovat");
    await expect(
      page.locator("main form").first().getByRole("button", { name: "Přispět a přidat se" }),
    ).toBeVisible();
  });

  test("the old /patrons address redirects to /membership", async ({ request }) => {
    const response = await request.get("/patrons", { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toMatch(/\/membership$/);
  });
});
