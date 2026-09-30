import { expect, test } from "@playwright/test";
import { adminNav, go, isPhone, open, signIn } from "./helpers";

/**
 * Telefon: menu, hledání, list s obsahem a administrace na úzké obrazovce.
 * Na počítači se tyhle testy přeskakují — tam platí rozvržení s panelem.
 */

test.beforeEach(async ({ page }) => {
  test.skip(!isPhone(page), "Phone layout only");
});

test("the menu reaches every page and closes on the way", async ({ page }) => {
  await open(page, "#/");
  await page.locator("#menuBtn").click();
  await expect(page.locator("#mnav")).toBeVisible();
  await page.locator(".mnav-links a", { hasText: "News" }).click();
  await expect(page.locator("#mnav")).toBeHidden();
  await expect(page.locator("#railScroll h1, #railScroll h2").first()).toContainText("News");
});

test("search opens over the whole screen and leads to a country", async ({ page }) => {
  await open(page, "#/");
  await page.locator("#dockSearch").click();
  await expect(page.locator("#q")).toBeFocused();
  await page.keyboard.type("ukraine");
  await page.locator("#results a", { hasText: "Ukraine" }).first().click();
  await expect(page).toHaveURL(/#\/country\/ukraine$/);
  await expect(page.locator("body")).not.toHaveClass(/m-search/);
});

test("a country opens as a half sheet that expands on a tap", async ({ page }) => {
  await open(page, "#/country/czechia");
  const rail = page.locator("#rail");
  await expect(rail).toHaveClass(/\bon\b/);
  await expect(rail).not.toHaveClass(/snap-full/);
  await page.locator("#sheetBar").click();
  await expect(rail).toHaveClass(/snap-full/);
});

test("the admin drawer moves between sections and closes itself", async ({ page }) => {
  await signIn(page, "Amara Okonjo");
  await adminNav(page, "settings");
  await expect(page.locator("body")).not.toHaveClass(/admin-drawer/);
  await expect(page.locator(".admin-mbar .title b")).toHaveText("Site settings");
});

test("no admin section scrolls sideways", async ({ page }) => {
  await signIn(page, "Amara Okonjo");
  for (const tab of ["overview", "news", "approvals", "areas", "regions", "metrics", "appearance",
    "groups", "users", "members", "permissions", "settings", "account"]) {
    await go(page, "#/admin/" + tab);
    await expect(page.locator(".admin-mbar .title b")).not.toHaveText("Atlas");
    const spill = await page.evaluate(() => {
      const box = document.getElementById("railScroll")!;
      return box.scrollWidth - box.clientWidth;
    });
    expect(spill, "section " + tab).toBeLessThanOrEqual(1);
  }
});

test("account tables turn into labelled cards", async ({ page }) => {
  await signIn(page, "Amara Okonjo");
  await adminNav(page, "users");
  const firstRow = page.locator(".data-table tbody tr").first();
  await expect(firstRow).toHaveCSS("display", "grid");
  await expect(firstRow.locator("td").nth(1)).toHaveAttribute("data-label", "E-mail");
});

test("settings tabs scroll as a strip and the save bar stays reachable", async ({ page }) => {
  await signIn(page, "Amara Okonjo");
  await adminNav(page, "settings");
  await page.locator('[data-stab="notifications"]').click();
  await page.locator('[data-set-bool="newsletter"]').click();
  await expect(page.locator("#setSave")).toBeInViewport();
  await page.locator("#setSaveBtn").click();
  await expect(page.locator("#toast")).toContainText("Settings saved");
});
