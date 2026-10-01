import { expect, test } from "@playwright/test";

/** Printing a profile: no globe, header or controls; the panel content stays whole. */
test("print version shows only the panel content", async ({ page }) => {
  await page.goto("/country/ukraine");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("header[data-print=hide]")).toBeHidden();
  await expect(page.locator("[data-print=content]")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Close" })).toBeHidden();
});
