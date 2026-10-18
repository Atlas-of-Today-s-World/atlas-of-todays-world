import { expect, test } from "@playwright/test";

/**
 * Entries list: one place filter at a time (country, region or special region)
 * and the full-text search inside the entries with excerpts linking to chapters.
 * Works on whatever entries atlas-dev has published.
 */
test("one place filter at a time, kept in the URL", async ({ page }) => {
  await page.goto("/entries");
  const country = page.getByLabel("Country");
  const region = page.getByLabel("Region", { exact: true });
  test.skip((await region.locator("option").count()) < 2, "no topics placed on a region");

  const value = (await region.locator("option").nth(1).getAttribute("value")) ?? "";
  await region.selectOption(value);
  await expect(page).toHaveURL((url) => url.searchParams.get("region") === value);

  if ((await country.locator("option").count()) > 1) {
    await country.selectOption({ index: 1 });
    await expect(region).toHaveValue("");
    await expect(page).not.toHaveURL(/region=/);
  }

  await page.getByRole("button", { name: "Show all entries" }).click();
  await expect(page).not.toHaveURL(/country=|region=|issue=/);
});

test("full-text search shows excerpts that link into the topic", async ({ page }) => {
  await page.goto("/entries");
  test.skip((await page.locator('a[href^="/entries/"]').count()) === 0, "no published topics");

  await page.getByLabel("Search in entries").fill("the");
  await expect(page.getByText(/match(es)? in the text/)).toBeVisible();
  const first = page.locator('a[href^="/entries/"]').first();
  await expect(first.locator("mark").first()).toBeVisible();
  await expect(first).toHaveAttribute("href", /^\/entries\/[a-z0-9-]+(?:$|#topic-\d+$)/);
});

test("a failed search shows an error and can be tried again", async ({ page }) => {
  await page.route("**/api/entries/search?*", (route) =>
    route.fulfill({ status: 429, json: { error: "Too many requests." } }),
  );
  await page.goto("/entries");
  await page.getByLabel("Search in entries").fill("the");
  await expect(page.getByText(/Search is unavailable right now/)).toBeVisible();
  await expect(page.getByText("Searching…")).toHaveCount(0);

  await page.unroute("**/api/entries/search?*");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText(/Search is unavailable right now/)).toHaveCount(0);
  await expect(page.getByText(/match(es)? in the text|Nothing found in the text/)).toBeVisible();
});

test("Back from a topic returns to the same place in the list", async ({ page }) => {
  await page.goto("/entries");
  // Full-width pages scroll their own frame, not the window.
  const frame = page.locator("#content");
  test.skip((await frame.locator('a[href^="/entries/"]').count()) === 0, "no published topics");
  const room = await frame.evaluate((el) => el.scrollHeight - el.clientHeight);
  test.skip(room < 400, "the list is too short to scroll");

  // Scroll halfway; the position is saved only once React listens, so retry.
  const half = Math.round(room / 2);
  await expect(async () => {
    await frame.evaluate((el, to) => {
      el.scrollTop = el.scrollTop === to ? to - 1 : to;
    }, half);
    await expect
      .poll(() => page.evaluate(() => Number(sessionStorage.getItem("atlas:scroll:/entries"))), {
        timeout: 2_000,
      })
      .toBeGreaterThan(half - 10);
  }).toPass({ timeout: 30_000 });
  const before = await frame.evaluate((el) => el.scrollTop);

  // A topic link in view, so clicking it doesn't scroll the list first.
  const href = await frame.evaluate((el) => {
    const inView = Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href^="/entries/"]')).find(
      (link) => {
        const box = link.getBoundingClientRect();
        return box.top > 120 && box.bottom < window.innerHeight - 120;
      },
    );
    return inView?.getAttribute("href") ?? null;
  });
  test.skip(href === null, "no topic link in view halfway down the list");
  await frame.locator(`a[href="${href}"]`).first().click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(href);
  // A fresh link starts the topic at the top.
  await expect.poll(() => frame.evaluate((el) => el.scrollTop)).toBeLessThan(50);

  await page.goBack();
  await expect(page).toHaveURL(/\/entries$/);
  await expect.poll(() => frame.evaluate((el) => el.scrollTop)).toBeGreaterThan(before - 60);
  expect(await frame.evaluate((el) => el.scrollTop)).toBeLessThan(before + 60);
});

test("“Write an entry” opens the volunteer form with the place filled in", async ({ page }) => {
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
