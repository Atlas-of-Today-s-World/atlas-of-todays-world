import { expect, test } from "@playwright/test";

/**
 * Topics list: one place filter at a time (country, region or special region)
 * and the full-text search inside the topics with excerpts linking to chapters.
 * Works on whatever topics atlas-dev has published.
 */
test("one place filter at a time, kept in the URL", async ({ page }) => {
  await page.goto("/topics");
  const country = page.getByLabel("Country");
  const region = page.getByLabel("Region", { exact: true });
  test.skip((await region.locator("option").count()) < 2, "no topics placed on a region");

  const value = await region.locator("option").nth(1).getAttribute("value");
  await region.selectOption(value ?? "");
  await expect(page).toHaveURL(new RegExp(`[?&]region=${value}`));

  if ((await country.locator("option").count()) > 1) {
    await country.selectOption({ index: 1 });
    await expect(region).toHaveValue("");
    await expect(page).not.toHaveURL(/region=/);
  }

  await page.getByRole("button", { name: "Show all topics" }).click();
  await expect(page).not.toHaveURL(/country=|region=|issue=/);
});

test("full-text search shows excerpts that link into the topic", async ({ page }) => {
  await page.goto("/topics");
  test.skip((await page.locator('a[href^="/topics/"]').count()) === 0, "no published topics");

  await page.getByLabel("Search in topics").fill("the");
  await expect(page.getByText(/match(es)? in the text/)).toBeVisible();
  const first = page.locator('a[href^="/topics/"]').first();
  await expect(first.locator("mark").first()).toBeVisible();
  await expect(first).toHaveAttribute("href", /^\/topics\/[a-z0-9-]+(#topic-\d+)?$/);
});
