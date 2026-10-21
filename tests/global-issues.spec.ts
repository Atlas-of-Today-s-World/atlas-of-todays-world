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
  await expect(cards.first()).toContainText(/\d+ (?:entry|entries)/i);
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

/**
 * A global issue's full page (2026-10-16, at …/full-page): like a topic —
 * photo header with the trail Atlas › Global issues › kind, the title, Share,
 * its countries, "Entries" (its topics, or the invitation to write the
 * first) and the globe in its corner window, which leads back to the map.
 */
test("a global issue's full page is a full-width page like a topic", async ({ page, isMobile }) => {
  await page.goto("/global-issue/russia-ukraine-war/full-page");

  const trail = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(trail.getByRole("link", { name: "Atlas", exact: true })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(trail.getByRole("link", { name: "Global issues" })).toHaveAttribute(
    "href",
    "/global-issues",
  );
  await expect(page.getByRole("heading", { level: 1, name: "Russia–Ukraine War" })).toBeVisible();
  await expect(
    page.locator("#content header").getByRole("button", { name: "Share" }),
  ).toBeVisible();

  // Its topics as subtopic tiles, or — with none yet — the call to write one.
  const subtopics = page.getByRole("region", { name: "Entries", exact: true });
  await expect(subtopics).toBeVisible();
  await expect(
    subtopics.locator('a[href^="/entries/"], a[href^="/membership"]').first(),
  ).toBeVisible();

  // No side panel: the page is the full width and the map's controls are gone.
  await expect(page.locator("[data-content-rail]")).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Global issues" })).toHaveCount(0);

  // The globe waits in its window bottom left (on phones out of the way; the
  // header's "Back to Atlas" leads back there).
  const globeWindow = page.locator("[data-globe-window]");
  if (isMobile) await expect(globeWindow).toBeHidden();
  else {
    await expect(globeWindow).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to the Atlas globe" })).toBeVisible();
  }
  await page.getByRole("link", { name: "Back to Atlas", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("[data-globe-window]")).toHaveCount(0);
});

test("a global issue opens as a wide preview with the way to its full page", async ({ page }) => {
  await page.goto("/global-issue/russia-ukraine-war");
  await expect(page.locator("[data-content-rail]")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Russia–Ukraine War" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Full page view" })).toHaveAttribute(
    "href",
    "/global-issue/russia-ukraine-war/full-page",
  );
  // The preview's canonical is the full page, so search engines index one of the two.
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/global-issue\/russia-ukraine-war\/full-page$/,
  );
});

test("the issue page's trail is in its structured data", async ({ page }) => {
  await page.goto("/global-issue/russia-ukraine-war/full-page");
  const scripts = page.locator('script[type="application/ld+json"]');
  const jsonLd = (await scripts.allTextContents()).join("");
  expect(jsonLd).toContain('"BreadcrumbList"');
  expect(jsonLd).toMatch(/"name":"Global issues","item":"[^"]*\/global-issues"/);
  expect(jsonLd).toContain('"Place"');
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
