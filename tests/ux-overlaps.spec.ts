import { expect, test, type Page } from "@playwright/test";

/**
 * Leftovers of the UX audit 2026-10-08:
 * 1. the globe window bottom left of full-width pages (topics, global issues)
 *    covered the summary at 1280 × 800 — no text may lie under it now, at any
 *    scroll position;
 * 2. on phones the map credits (i) hid under the open bottom sheet;
 * 3. the search over the map listed only topics for "congo" on a phone while
 *    the desktop listed the countries too — the same list, countries first.
 */

const LAPTOP = { width: 1280, height: 800 };
const WIDE = { width: 1920, height: 1080 };
const PHONE = { width: 390, height: 844 };

/** Text (as drawn, clipped by scrolling ancestors) of the page that lies under the globe window. */
function textUnderGlobeWindow(page: Page) {
  return page.evaluate(() => {
    const windowBox = document.querySelector("[data-globe-window]")?.getBoundingClientRect();
    if (!windowBox || windowBox.width === 0) return ["no globe window"];
    const content = document.getElementById("content");
    if (!content) return ["no #content"];
    const hits: string[] = [];
    const range = document.createRange();
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || !node.textContent?.trim()) continue;
      const style = getComputedStyle(parent);
      const clipped = (style.clip && style.clip !== "auto") || style.clipPath !== "none";
      if (style.visibility === "hidden" || clipped) continue;
      // What scrolling or clipping ancestors leave visible of the text.
      let left = -Infinity;
      let right = Infinity;
      let top = -Infinity;
      let bottom = Infinity;
      for (let el: HTMLElement | null = parent; el && el !== content; el = el.parentElement) {
        const own = getComputedStyle(el);
        if (own.opacity === "0" || own.display === "none") left = Infinity;
        if (own.overflowX !== "visible" || own.overflowY !== "visible") {
          const box = el.getBoundingClientRect();
          left = Math.max(left, box.left);
          right = Math.min(right, box.right);
          top = Math.max(top, box.top);
          bottom = Math.min(bottom, box.bottom);
        }
      }
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        const x1 = Math.max(rect.left, left, windowBox.left);
        const x2 = Math.min(rect.right, right, windowBox.right);
        const y1 = Math.max(rect.top, top, windowBox.top);
        const y2 = Math.min(rect.bottom, bottom, windowBox.bottom);
        if (x2 - x1 > 1 && y2 - y1 > 1) {
          hits.push(
            `"${node.textContent.trim().slice(0, 40)}" at ${Math.round(rect.left)},${Math.round(rect.top)}`,
          );
          break;
        }
      }
    }
    return hits;
  });
}

/** Scrolls the full-width page from top to bottom and collects text found under the window. */
async function overlapsWhileScrolling(page: Page) {
  const found = new Set<string>();
  const height = await page.locator("#content").evaluate((el) => el.scrollHeight);
  for (let y = 0; y <= height; y += 300) {
    await page.locator("#content").evaluate((el, top) => el.scrollTo(0, top), y);
    await page.waitForTimeout(50);
    for (const hit of await textUnderGlobeWindow(page)) found.add(`${y}: ${hit}`);
  }
  return [...found];
}

/** The first topic the Topics list shows (atlas-dev has imported ones). */
async function firstTopic(page: Page) {
  await page.goto("/topics");
  const href = await page.locator('a[href^="/topics/"]').first().getAttribute("href");
  expect(href).toMatch(/^\/topics\/[a-z0-9-]+$/);
  return href!;
}

test.describe("globe window beside full-width pages", () => {
  test.skip(({ isMobile }) => isMobile, "viewport set per test");

  for (const viewport of [LAPTOP, WIDE]) {
    test(`no text under it on a topic and a global issue at ${viewport.width} × ${viewport.height}`, async ({
      page,
    }) => {
      test.setTimeout(150_000);
      await page.setViewportSize(viewport);
      const topic = await firstTopic(page);
      for (const path of [topic, "/global-issue/russia-ukraine-war", "/topics"]) {
        await page.goto(path);
        const globeWindow = page.locator("[data-globe-window]");
        await expect(globeWindow).toBeVisible();
        // Still the way back to the map: a link with a name, at least a touch target.
        const link = page.getByRole("link", { name: "Back to the Atlas globe" });
        await expect(link).toBeVisible();
        // At 1280 the round button, from 1712 px the full window (after its
        // shrinking animation from the full map).
        const width = async () => (await globeWindow.boundingBox())?.width ?? 0;
        if (viewport.width < 1712) {
          await expect.poll(width).toBeLessThanOrEqual(64);
          expect(await width()).toBeGreaterThanOrEqual(44);
        } else {
          await expect.poll(width).toBeLessThanOrEqual(280);
          expect(await width()).toBeGreaterThan(200);
        }
        expect(await overlapsWhileScrolling(page), `${path} at ${viewport.width}`).toEqual([]);
        await expect(page.locator("#content")).toHaveJSProperty(
          "scrollWidth",
          await page.locator("#content").evaluate((el) => el.clientWidth),
        );
      }
    });
  }
});

test.describe("map credits on phones", () => {
  test.skip(({ isMobile }) => isMobile, "viewport set per test");

  test("the (i) stays above the open bottom sheet and can be tapped", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto("/country/ukraine");
    const credits = page.locator(".maplibregl-ctrl-attrib").first();
    await expect(credits).toBeVisible({ timeout: 30_000 });
    const sheet = page.locator("aside[data-content-rail]#content");
    await expect(sheet).toBeVisible();
    // The sheet's opening animation and the globe settle first.
    await expect(async () => {
      const [creditsBox, sheetBox] = [await credits.boundingBox(), await sheet.boundingBox()];
      expect(creditsBox!.y + creditsBox!.height).toBeLessThanOrEqual(sheetBox!.y + 1);
      expect(creditsBox!.y).toBeGreaterThan(0);
    }).toPass({ timeout: 10_000 });
    // Nothing else lies on top of it: a tap reaches the button.
    const box = (await credits.boundingBox())!;
    const topmost = await page.evaluate(
      ({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest(".maplibregl-ctrl-attrib")),
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    );
    expect(topmost).toBe(true);
  });
});

test.describe("search results on phone and desktop", () => {
  test.skip(({ isMobile }) => isMobile, "viewport set per test");

  /** The rows of the search list over the map for `query` (without "See all results"). */
  async function results(page: Page, query: string) {
    await page.goto("/");
    const search = page.getByRole("combobox", { name: /Search places/ });
    const options = page.getByRole("listbox").getByRole("option");
    // Typing before hydration doesn't reach React: retype until the list opens.
    await expect(async () => {
      await search.fill("");
      await search.fill(query);
      await expect(options.first()).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
    const rows = await options.allTextContents();
    return rows.filter((row) => row !== "See all results");
  }

  test('"congo" lists the same results, countries first, on a phone and a laptop', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(PHONE);
    const phone = await results(page, "congo");
    await page.setViewportSize(LAPTOP);
    const laptop = await results(page, "congo");

    expect(phone).toEqual(laptop);
    expect(phone[0]).toMatch(/^Country/);
    expect(phone.some((row) => /^Country.*Democratic Republic of the Congo/.test(row))).toBe(true);
    // Every country comes before any topic or news item.
    const kinds = phone.map((row) => (/^Country/.test(row) ? 0 : 1));
    expect(kinds).toEqual([...kinds].sort());
  });
});
