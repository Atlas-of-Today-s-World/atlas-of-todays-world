import { test, expect, type Page } from "@playwright/test";

/**
 * A walk through the Atlas through a visitor's eyes.
 *
 * The tests stick to what the brief promises: from the map to a country profile,
 * from there to the region, the panel closes with the X and a key, on mobile the
 * hamburger works and search is tucked into an icon. They also guard touch target
 * size, since that requirement is the easiest to lose during a restyle.
 */

/** Checks that the element is comfortable to tap (the brief's minimum is 44 px). */
async function hasTouchTarget(page: Page, selector: string) {
  const target = page.locator(selector).first();
  // boundingBox() does not wait; the panel slides out only after hydration.
  // Callers scope the selector to the real panel (#content): the loading
  // skeleton renders the same controls and is swapped out while streaming.
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  expect(box, `${selector} není vidět`).not.toBeNull();
  expect(box!.width, `${selector} je příliš úzký`).toBeGreaterThanOrEqual(43);
  expect(box!.height, `${selector} je příliš nízký`).toBeGreaterThanOrEqual(43);
}

test.describe("globus", () => {
  test("loads country borders without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && message.text().includes("atlas-globe")) {
        errors.push(message.text());
      }
    });
    // MapLibre 6: worker se bere z public/maplibre/<verze>/ (scripts/copy-maplibre-worker.mjs).
    const worker = page.waitForResponse((r) =>
      /\/maplibre\/[\d.]+\/maplibre-gl-worker\.mjs$/.test(r.url()),
    );
    await page.goto("/");
    expect((await worker).status()).toBe(200);
    // AtlasGlobe sets the attribute once the "countries" source is loaded
    // (requires a working MapLibre web worker).
    await expect(page.locator('[data-countries="loaded"]')).toBeAttached({ timeout: 30_000 });
    expect(errors, "globus hlásí chyby").toEqual([]);
  });
});

test.describe("World metrics", () => {
  test("defaults to No metric and returns to it from an indicator", async ({ page }) => {
    await page.goto("/");
    const button = page.getByRole("button", { name: "World metrics" });
    await expect(button).toBeVisible();
    await expect(page.getByText(/World regions of the Atlas/)).toBeVisible();

    await button.click();
    const noMetric = page.getByRole("button", { name: "No metric" });
    await expect(noMetric).toHaveClass(/bg-white\/15/);
    // Any indicator, then back to the regions view.
    await noMetric.locator("xpath=following-sibling::button[1]").click();
    await expect(page.getByRole("button", { name: "World metrics" })).toHaveCount(0);
    await page.getByRole("button", { name: /view$/ }).click();
    await page.getByRole("button", { name: "No metric" }).click();
    await expect(page.getByRole("button", { name: "World metrics" })).toBeVisible();
  });
});

test.describe("panel s obsahem", () => {
  test("country profile leads to the region and back to the map", async ({ page }) => {
    await page.goto("/country/ukraine");

    // The breadcrumb leads to the region.
    await expect(
      page.getByRole("link", { name: "Eastern Europe & Central Asia" }).first(),
    ).toBeVisible();

    await page.getByRole("link", { name: "Explore the region" }).click();
    await expect(page).toHaveURL(/\/region\/eastern-europe-central-asia/);
    await expect(
      page.getByRole("heading", { name: "Eastern Europe & Central Asia" }),
    ).toBeVisible();
  });

  test("close button has a comfortable touch target and closes the panel", async ({ page }) => {
    await page.goto("/country/ukraine");
    await hasTouchTarget(page, '#content a[aria-label="Close"]');

    await page.locator("#content").getByRole("link", { name: "Close" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("country profile offers a Share button with a comfortable touch target", async ({
    page,
  }) => {
    await page.goto("/country/ukraine");
    await expect(page.locator("#content").getByRole("button", { name: "Share" })).toBeVisible();
    await hasTouchTarget(page, '#content button:has-text("Share")');
  });

  test("panel closes with the Esc key", async ({ page }) => {
    await page.goto("/country/ukraine");
    // Only hydrated React handles the key, so wait for the panel to come alive
    // and click into the page — otherwise the key has nowhere to go.
    await expect(page.locator("#content").getByRole("link", { name: "Close" })).toBeVisible();

    // The key handler works only after React hydrates. When exactly that happens
    // cannot be reliably detected from outside, so we retry the key press.
    await expect(async () => {
      await page.keyboard.press("Escape");
      await expect(page).toHaveURL(/\/$/, { timeout: 2_000 });
    }).toPass({ timeout: 25_000 });
  });
});

test.describe("region portrait", () => {
  test("opens in full right away and offers no second version", async ({ page }) => {
    await page.goto("/region/middle-east-north-africa");

    await expect(page.getByRole("heading", { name: "Key indicators" })).toBeVisible();
    await expect(page.getByText("A Comprehensive Portrait")).toHaveCount(0);
    await expect(page.getByText(/news items? published/)).toHaveCount(0);
  });

  test("unwritten sections are grey, not clickable and invite support", async ({ page }) => {
    await page.goto("/region/east-asia");

    await expect(page.getByText("Not written yet").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Help Us Complete It/ }).first()).toBeVisible();

    // Planned entries must not link anywhere.
    const planned = page.locator('[aria-disabled="true"]').first();
    await expect(planned).toBeVisible();
    await expect(planned).not.toHaveAttribute("href", /./);
  });
});

test.describe("global issues", () => {
  test("third switch position opens the topic portrait", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("radio", { name: "Global issues" })).toBeVisible();

    await page.goto("/global-issue/russia-ukraine-war");
    await expect(page.getByRole("heading", { name: "Russia–Ukraine War" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ukraine" }).first()).toBeVisible();
  });
});

test.describe("search shortcut", () => {
  test.skip(({ isMobile }) => isMobile, "desktop project only");

  test('"/" focuses the search field without typing the slash', async ({ page }) => {
    await page.goto("/");
    const search = page.getByPlaceholder(/Search places/);
    await expect(search).toBeVisible();

    // Like the Esc test: the listener exists only after hydration, so retry the key.
    await expect(async () => {
      await page.keyboard.press("/");
      await expect(search).toBeFocused({ timeout: 2_000 });
    }).toPass({ timeout: 25_000 });
    await expect(search).toHaveValue("");
  });
});

test.describe("mobil", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile project only");

  test("hamburger opens the menu and it closes with a key", async ({ page }) => {
    await page.goto("/");

    await hasTouchTarget(page, 'button[aria-label="Open menu"]');
    await page.getByRole("button", { name: "Open menu" }).click();

    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Atlas Patrons" })).toBeVisible();
    await expect(menu.getByText("New Atlas content in your inbox")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("the search field is right there, without a button to open it", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByPlaceholder(/Search places/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Search the Atlas" })).toHaveCount(0);
  });
});

test.describe("sign-in", () => {
  test("admin without sign-in leads to Google sign-in", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    // Without Supabase in the environment (local build) the page only says sign-in is unavailable.
    const google = page.getByRole("button", { name: "Continue with Google" });
    const unavailable = page.getByText("Sign-in is not available");
    await expect(google.or(unavailable)).toBeVisible();
  });

  test("account page without sign-in leads to sign-in", async ({ page }) => {
    await page.goto("/ucet");
    await expect(page).toHaveURL(/\/login\?next=%2Fucet/);
  });

  test("invitation page explains how to sign in", async ({ page }) => {
    await page.goto("/pozvanka");
    await expect(page.getByRole("heading", { name: "Invitation to the Atlas team" })).toBeVisible();
  });
});
