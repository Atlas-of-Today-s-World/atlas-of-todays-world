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

    // No region teaser card any more (2026-10-16): the region's profile follows
    // under the country, and the breadcrumb is the way to the region itself.
    await expect(page.getByRole("link", { name: "Explore the region" })).toHaveCount(0);
    await page.getByRole("link", { name: "Eastern Europe & Central Asia" }).first().click();
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

  test("country preview is wide and opens its full page view", async ({ page, isMobile }) => {
    await page.goto("/country/ukraine");
    const panel = page.locator("#content");
    if (!isMobile) {
      // The wide panel of every place preview (--rail-width-wide), not the narrow one.
      const width = await panel.evaluate((node) => node.getBoundingClientRect().width);
      const wide = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--rail-width-wide"),
      );
      expect(wide).not.toBe("");
      expect(width).toBeGreaterThan(500);
    }
    await hasTouchTarget(page, '#content a:has-text("Full page view")');

    await panel.getByRole("link", { name: "Full page view" }).click();
    await expect(page).toHaveURL(/\/country\/ukraine\/full-page$/);
    await expect(page.getByRole("heading", { level: 1, name: "Ukraine" })).toBeVisible();
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

test.describe("Largest Contentful Paint on panel pages", () => {
  // The carousels (Rail) used to snap 4 px on their first layout; Chrome takes that
  // scroll for the reader's and stops recording LCP before the first candidate, so
  // these pages reported none (Lighthouse NO_LCP, no LCP in the field either).
  for (const path of ["/country/ukraine", "/region/eastern-europe-central-asia"]) {
    test(`${path} reports an LCP and no carousel scrolls by itself`, async ({ page }) => {
      await page.addInitScript(() => {
        const entries: number[] = [];
        Object.assign(window, { lcpEntries: entries });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) entries.push(entry.startTime);
        }).observe({ type: "largest-contentful-paint", buffered: true });
      });
      await page.goto(path);
      await expect(page.locator("#content")).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => (window as unknown as { lcpEntries: number[] }).lcpEntries))
        .not.toEqual([]);
      const scrolled = await page
        .locator("#content .snap-x")
        .evaluateAll((tracks) => tracks.map((track) => track.scrollLeft));
      expect(scrolled.length).toBeGreaterThan(0);
      expect(scrolled.every((left) => left === 0)).toBe(true);
    });
  }
});

test.describe("regional profile under a country", () => {
  test("a country of a region shows the region's profile below its own data", async ({ page }) => {
    await page.goto("/country/turkey");

    const profile = page.getByRole("region", { name: "Middle East & North Africa" });
    await expect(profile.getByText("Regional profile")).toBeVisible();
    // No themed topic rows or news strip in a profile (owner's decision of 2026-10-15).
    await expect(profile.getByRole("heading", { name: "Entries", exact: true })).toHaveCount(0);
    await expect(profile.getByRole("heading", { name: "Our News" })).toHaveCount(0);
    await expect(profile.getByRole("link", { name: /View the whole region/ })).toHaveAttribute(
      "href",
      "/region/middle-east-north-africa",
    );
  });
});

test.describe("region portrait", () => {
  test("opens in full right away and offers no second version", async ({ page }) => {
    await page.goto("/region/middle-east-north-africa");

    await expect(
      page.getByRole("heading", { level: 1, name: "Middle East & North Africa" }),
    ).toBeVisible();
    // Share sits above the heading; the countries are only in the header's list.
    await expect(page.locator("#content").getByRole("button", { name: "Share" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Countries in this region" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Entries", exact: true })).toHaveCount(0);
    // No computed regional averages (decision of 2026-10-07): national data live on each
    // country. The editors' sourced key-fact cards may show; computed figures never.
    await expect(page.getByText(/Population-weighted across the countries/)).toHaveCount(0);
    await expect(page.getByText("A Comprehensive Portrait")).toHaveCount(0);
    await expect(page.getByText(/news items? published/)).toHaveCount(0);
  });

  test("unwritten sections are left out and the page invites support", async ({ page }) => {
    await page.goto("/region/east-asia");

    // Unwritten parts are left out (no "coming" list); only the support call remains.
    await expect(page.getByRole("heading", { name: "Coming to this portrait" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Help us complete it/ }).first()).toBeVisible();
  });
});

test.describe("global issues", () => {
  test("third switch position opens the topic portrait", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("radio", { name: "Global issues" })).toBeVisible();

    // The full page (2026-10-16): its countries are listed open under the count.
    await page.goto("/global-issue/russia-ukraine-war/full-page");
    await expect(page.getByRole("heading", { level: 1, name: "Russia–Ukraine War" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Countries: \d+$/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(
      page.locator("#content").getByRole("link", { name: "Ukraine", exact: true }).first(),
    ).toBeVisible();
    // Its topics are its "Subtopics" (2026-10-16), not the panel's "Related topics".
    await expect(page.getByRole("heading", { level: 2, name: "Subtopics" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Related topics" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Countries in this group" })).toHaveCount(0);
    // No "N news items published" line either (2026-10-15).
    await expect(page.getByText(/news items? published/)).toHaveCount(0);
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

  test("Enter in the search over the map opens the full results page", async ({ page }) => {
    await page.goto("/");
    const search = page.getByRole("combobox", { name: /Search places/ });
    await search.fill("Japan");
    await expect(async () => {
      await search.press("Enter");
      await expect(page).toHaveURL(/\/search\?q=Japan$/, { timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
  });

  test("arrow keys highlight a result and Enter opens it", async ({ page }) => {
    await page.goto("/");
    const search = page.getByRole("combobox", { name: /Search places/ });
    const options = page.getByRole("listbox").getByRole("option");
    // Typing before hydration doesn't reach React: retype until the list opens.
    await expect(async () => {
      await search.fill("");
      await search.fill("Japan");
      await expect(options.first()).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
    await expect(search).toHaveAttribute("aria-expanded", "true");
    // The count is announced; the last row leads to all results.
    await expect(
      page.getByRole("region", { name: "Global Encyclopedia" }).getByRole("status"),
    ).toHaveText(/^\d+ results?$/);
    await expect(options.last()).toHaveText("See all results");
    await expect(options.last()).toHaveAttribute("href", "/search?q=Japan");

    // ↓ ↓ ↑ ends on the first result, with focus still in the field.
    await search.press("ArrowDown");
    await search.press("ArrowDown");
    await search.press("ArrowUp");
    const first = options.first();
    await expect(first).toHaveAttribute("aria-selected", "true");
    await expect(search).toHaveAttribute(
      "aria-activedescendant",
      (await first.getAttribute("id"))!,
    );
    await expect(search).toBeFocused();

    const href = (await first.getAttribute("href"))!;
    await search.press("Enter");
    await expect.poll(() => new URL(page.url()).pathname).toBe(new URL(href, page.url()).pathname);
  });

  test("Esc empties the search field without closing the open panel", async ({ page }) => {
    await page.goto("/country/ukraine");
    const search = page.getByRole("combobox", { name: /Search places/ });
    await expect(async () => {
      await search.fill("");
      await search.fill("Japan");
      await expect(page.getByRole("listbox").getByRole("option").first()).toBeVisible({
        timeout: 5_000,
      });
    }).toPass({ timeout: 30_000 });
    await search.press("Escape");
    await expect(search).toHaveValue("");
    await expect(search).toHaveAttribute("aria-expanded", "false");
    await expect(page).toHaveURL(/\/country\/ukraine$/);
  });

  test("a failed search over the map says so instead of “nothing found”", async ({ page }) => {
    await page.route("**/api/search?*", (route) =>
      route.fulfill({ status: 429, json: { error: "Too many requests." } }),
    );
    await page.goto("/");
    await page.getByRole("combobox", { name: /Search places/ }).fill("Japan");
    await expect(page.getByText(/Search is unavailable right now/)).toBeVisible();
    await expect(page.getByText("Nothing found in the Atlas yet.")).toHaveCount(0);
  });

  test("search results use full country names", async ({ page }) => {
    await page.goto("/search?q=Congo");
    await expect(page.getByText("Democratic Republic of the Congo").first()).toBeVisible();
    await expect(page.getByText("Dem. Rep. Congo")).toHaveCount(0);
  });

  test("the panel can be hidden and shown again", async ({ page }) => {
    await page.goto("/country/ukraine");
    const panelLeft = () =>
      page.locator("aside#content").evaluate((aside) => aside.getBoundingClientRect().left);
    const width = page.viewportSize()?.width ?? 1280;
    // The tab must be clickable (it used to be clipped by the panel itself).
    await page.getByRole("button", { name: "Hide panel" }).click();
    await expect.poll(panelLeft).toBeGreaterThanOrEqual(width - 1);
    await page.getByRole("button", { name: "Show panel" }).click();
    await expect.poll(panelLeft).toBeLessThan(width - 100);
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
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
  });

  test("invitation page explains how to sign in", async ({ page }) => {
    await page.goto("/invite");
    await expect(page.getByRole("heading", { name: "Invitation to the Atlas team" })).toBeVisible();
  });

  test("old Czech account addresses redirect permanently, with their query", async ({
    request,
  }) => {
    const moved: [string, string][] = [
      ["/ucet", "/account"],
      ["/pozvanka?email=x%40example.org&ref=mail", "/invite?email=x%40example.org&ref=mail"],
    ];
    for (const [old, now] of moved) {
      const response = await request.get(old, { maxRedirects: 0 });
      expect(response.status(), old).toBe(308);
      const location = new URL(response.headers().location ?? "", "https://atlas.example");
      expect(`${location.pathname}${location.search}`, old).toBe(now);
    }
  });

  test("an invitation link sent before the rename still opens the invitation", async ({ page }) => {
    await page.goto("/pozvanka?ref=mail");
    await expect(page).toHaveURL(/\/invite\?ref=mail$/);
    await expect(page.getByRole("heading", { name: "Invitation to the Atlas team" })).toBeVisible();
  });
});

test.describe("account menu", () => {
  test("signed out: opens by keyboard, offers sign-in back to the page, closes", async ({
    page,
    isMobile,
  }) => {
    // Phones reach it through the site menu: "works from the globe header and the mobile menu".
    test.skip(isMobile, "the header's person icon shows from the lg breakpoint");
    await page.goto("/about");
    const button = page.getByRole("button", { name: "Sign in or open your account" });
    await expect(button).toHaveAttribute("aria-haspopup", "menu");
    await expect(button).toHaveAttribute("aria-expanded", "false");

    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    const menu = page.getByRole("menu");
    const signIn = menu.getByRole("menuitem", { name: "Sign in" });
    await expect(signIn).toBeFocused();
    await expect(signIn).toHaveAttribute("href", "/login?next=%2Fabout");
    await expect(menu.getByRole("menuitem")).toHaveCount(1);

    // Esc closes and gives the focus back to the button.
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(button).toBeFocused();

    // A click outside closes it too.
    await button.click();
    await expect(signIn).toBeVisible();
    await page.getByRole("heading", { level: 1 }).click();
    await expect(menu).toHaveCount(0);

    await button.click();
    await signIn.click();
    await expect(page).toHaveURL(/\/login\?next=%2Fabout$/);
  });

  test("never cached and only the five fields", async ({ request }) => {
    const response = await request.get("/api/me");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(Object.keys(await response.json()).sort()).toEqual([
      "email",
      "isStaff",
      "name",
      "roleName",
      "signedIn",
    ]);
  });

  test("works from the globe header and the mobile menu", async ({ page, isMobile }) => {
    // Starts at a desktop width (the globe header) and sets the phone width itself.
    test.skip(isMobile, "viewport set in the test");
    await page.goto("/");
    await page.getByRole("button", { name: "Sign in or open your account" }).click();
    await expect(page.getByRole("menuitem", { name: "Sign in" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/about");
    await page.getByRole("button", { name: "Open menu" }).click();
    const dialog = page.getByRole("dialog", { name: "Menu" });
    await dialog.getByRole("button", { name: "Account", exact: true }).click();
    // The menu opens inside the modal site menu, so it stays reachable.
    await expect(dialog.getByRole("menuitem", { name: "Sign in" })).toBeVisible();
    // Esc closes the account menu first, the site menu stays open.
    await page.keyboard.press("Escape");
    await expect(dialog.getByRole("menu")).toHaveCount(0);
    await expect(dialog).toBeVisible();
  });
});

test.describe("country list", () => {
  test("lists every region with its countries, linked to their profiles", async ({ page }) => {
    await page.goto("/countries");
    await expect(
      page.getByRole("heading", { level: 1, name: "Countries and regions" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Ukraine", exact: true })).toHaveAttribute(
      "href",
      "/country/ukraine",
    );
    const region = page.getByRole("heading", { level: 2 }).getByRole("link").first();
    await expect(region).toHaveAttribute("href", /^\/region\//);
    await page.getByRole("link", { name: "Czechia", exact: true }).click();
    await expect(page).toHaveURL(/\/country\/czechia$/);
  });

  test("the home map offers the list to keyboard users instead of hidden links", async ({
    page,
  }) => {
    await page.goto("/");
    const browse = page.getByRole("link", { name: "Browse all countries and regions" });
    await expect(browse).toHaveAttribute("href", "/countries");
    await expect(page.locator("#content").getByRole("link")).toHaveCount(1);
  });
});
