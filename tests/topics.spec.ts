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

test("a failed search shows an error and can be tried again", async ({ page }) => {
  await page.route("**/api/topics/search?*", (route) =>
    route.fulfill({ status: 429, json: { error: "Too many requests." } }),
  );
  await page.goto("/topics");
  await page.getByLabel("Search in topics").fill("the");
  await expect(page.getByText(/Search is unavailable right now/)).toBeVisible();
  await expect(page.getByText("Searching…")).toHaveCount(0);

  await page.unroute("**/api/topics/search?*");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText(/Search is unavailable right now/)).toHaveCount(0);
  await expect(page.getByText(/match(es)? in the text|Nothing found in the text/)).toBeVisible();
});

test("“Write a topic” opens the volunteer form with the place filled in", async ({ page }) => {
  // East Asia has no topics yet, so its portrait shows the full invitation.
  await page.goto("/region/east-asia");
  const write = page.getByRole("link", { name: "Write a topic" }).first();
  test.skip((await write.count()) === 0, "East Asia already has topics");
  await expect(write).toHaveAttribute("href", /^\/membership\?topic=[^#]+#volunteer$/);

  await write.click();
  await expect(page).toHaveURL(/\/membership\?topic=.+#volunteer$/);
  const section = page.getByRole("region", { name: "Write for the Atlas as a volunteer" });
  await expect(section.getByLabel("What would you like to write about?")).toHaveValue(/East Asia/);
});
