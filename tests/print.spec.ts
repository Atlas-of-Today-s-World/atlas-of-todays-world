import { expect, test } from "@playwright/test";

/** Tisk profilu: bez glóbu, hlavičky a ovládání, obsah panelu zůstane celý. */
test("tisková verze ukáže jen obsah panelu", async ({ page }) => {
  await page.goto("/country/ukraine");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("header[data-print=hide]")).toBeHidden();
  await expect(page.locator("[data-print=content]")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close" })).toBeHidden();
});
