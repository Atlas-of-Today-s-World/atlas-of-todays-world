import { expect, test } from "@playwright/test";
import { COOKIE_NOTICE_SECONDS } from "../src/config/cookies";

/**
 * Cookie notice on the first visit: information only (the site has no
 * tracking cookies), so it closes by itself after a visible countdown and
 * doesn't come back.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("the cookie notice counts down, closes by itself and stays closed", async ({ page }) => {
  await page.clock.install();
  await page.goto("/about");
  const notice = page.getByRole("region", { name: "Cookie notice" });
  await expect(notice).toBeVisible();
  await expect(notice.getByText(`Closes in ${COOKIE_NOTICE_SECONDS} s`)).toBeVisible();
  await expect(notice.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  // The notice is in the static HTML; its countdown starts once the page is live.
  await expect(notice).toHaveAttribute("data-countdown", "running");

  await page.clock.fastForward(COOKIE_NOTICE_SECONDS * 1000 + 500);
  await expect(notice).toBeHidden();

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(notice).toHaveCount(0);
});

test("OK closes the cookie notice right away", async ({ page }) => {
  await page.goto("/about");
  const notice = page.getByRole("region", { name: "Cookie notice" });
  await expect(notice).toHaveAttribute("data-countdown", "running");
  await notice.getByRole("button", { name: "OK" }).click();
  await expect(notice).toBeHidden();
});
