import { expect, test } from "@playwright/test";

/**
 * A region in its two views (owner's request of 2026-10-16): the wide preview
 * beside the globe, and the full page behind "Full page view" — the same
 * sections as a global issue, ending bottom left with "Back to Atlas".
 */
const REGION = "/region/middle-east-north-africa";

test("a region opens as a wide preview with the way to its full page", async ({ page }) => {
  await page.goto(REGION);
  await expect(page.locator("[data-content-rail]")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { level: 1, name: "Middle East & North Africa" }),
  ).toBeVisible();
  const full = page.getByRole("link", { name: "Full page view" });
  await expect(full).toHaveAttribute("href", `${REGION}/full-page`);
  // The preview points search engines at the full page.
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    new RegExp(`${REGION}/full-page$`),
  );
  await full.click();
  await expect(page).toHaveURL(new RegExp(`${REGION}/full-page$`));
});

test("a region's full page is an article that ends with Back to Atlas", async ({
  page,
  isMobile,
}) => {
  await page.goto(`${REGION}/full-page`);
  await expect(page.locator("[data-content-rail]")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 1, name: "Middle East & North Africa" }),
  ).toBeVisible();

  const trail = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(trail.getByRole("link", { name: "Atlas", exact: true })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(trail.getByRole("link", { name: "Countries and regions" })).toHaveAttribute(
    "href",
    "/countries",
  );

  // Its topics in the four theme rows, or the invitation to write the first.
  const subtopics = page.getByRole("region", { name: "Subtopics" });
  await expect(subtopics).toBeVisible();

  // Bottom left: the way back to the globe, after the article.
  const back = page.locator("#content article").getByRole("link", { name: "Back to Atlas" });
  await expect(back).toHaveAttribute("href", "/");
  await back.scrollIntoViewIfNeeded();
  const box = await back.boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport && box.x < viewport.width / 2).toBeTruthy();

  if (!isMobile) await expect(page.locator("[data-globe-window]")).toBeVisible();
  await back.click();
  await expect(page).toHaveURL(/\/$/);
});

test("the country panel has no region teaser card; its topics follow the region's profile", async ({
  page,
}) => {
  await page.goto("/country/turkey");
  await expect(page.getByRole("link", { name: "Explore the region" })).toHaveCount(0);
  const regional = page.getByRole("region", { name: "Middle East & North Africa" });
  await expect(regional).toBeVisible();
  // The country's topics (or their invitation) come after the region's profile.
  const subtopics = page.getByRole("region", { name: "Subtopics" });
  if ((await subtopics.count()) > 0) {
    const regionBox = await regional.boundingBox();
    const topicsBox = await subtopics.boundingBox();
    expect(regionBox && topicsBox && topicsBox.y > regionBox.y).toBeTruthy();
  }
});
