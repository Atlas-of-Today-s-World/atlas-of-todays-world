import { expect, test } from "@playwright/test";

/**
 * Global issues overview (/global-issues): the Topics page's look for the
 * other kind of content — a card per global issue, one place filter at a time
 * (country, region or custom region, through the issue's member countries) and
 * a search over the cards. Works on whatever issues atlas-dev has.
 */
test("lists the global issues as cards leading to their portraits", async ({ page }) => {
  await page.goto("/global-issues");
  await expect(page.getByRole("heading", { level: 1, name: "Global issues" })).toBeVisible();
  const cards = page.locator('#content a[href^="/global-issue/"]');
  test.skip((await cards.count()) === 0, "no global issues on atlas-dev");
  await expect(cards.first()).toContainText(/\d+ topics?/i);
});

test("one place filter at a time, kept in the URL", async ({ page }) => {
  await page.goto("/global-issues");
  const country = page.getByLabel("Country", { exact: true });
  const region = page.getByLabel("Region", { exact: true });
  test.skip((await country.locator("option").count()) < 2, "no issue has a member country");

  const iso3 = (await country.locator("option").nth(1).getAttribute("value")) ?? "";
  await country.selectOption(iso3);
  await expect(page).toHaveURL((url) => url.searchParams.get("country") === iso3.toLowerCase());
  await expect(page.getByRole("heading", { name: /^Global issues related to / })).toBeVisible();
  await expect(page.locator('#content a[href^="/global-issue/"]').first()).toBeVisible();

  await region.selectOption({ index: 1 });
  await expect(country).toHaveValue("");
  await expect(page).not.toHaveURL(/country=/);

  await page.getByRole("button", { name: "Show all global issues" }).click();
  await expect(page).not.toHaveURL(/country=|region=|custom-region=/);
});

test("the search narrows the cards and says when nothing matches", async ({ page }) => {
  await page.goto("/global-issues");
  const search = page.getByLabel("Search in global issues");
  await search.fill("zzzqqq");
  await expect(page.getByText("No global issue matches your search.")).toBeVisible();
  await search.fill("");
  await expect(page.getByText("No global issue matches your search.")).toHaveCount(0);
});

test("the issue tiles over the map lead to the overview", async ({ page, isMobile }) => {
  test.skip(isMobile, "the mode switch is checked on desktop");
  await page.goto("/");
  await page.getByRole("radio", { name: "Global issues" }).click();
  const all = page.getByRole("link", { name: "All global issues" });
  test.skip((await all.count()) === 0, "no global issues on atlas-dev");
  await all.click();
  await expect(page).toHaveURL(/\/global-issues$/);
});
