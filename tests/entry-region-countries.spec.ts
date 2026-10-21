import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  cleanUp,
  createUser,
  requireDevAccounts,
  service,
  signIn,
  testEmail,
} from "./support/accounts";

/**
 * An entry's countries from its region (owner, 2026-10-21): one button under
 * the country picker adds every country of the region chosen above, and the
 * draft saves them as the entry's countries.
 */
requireDevAccounts();

const slug = `e2e-region-countries-${randomUUID().slice(0, 8)}`;
let email = "";

test.beforeAll(async () => {
  email = testEmail("region-countries");
  await createUser(email, "publisher");
});

test.afterAll(async () => {
  if (!service) return;
  await service.from("entries").delete().eq("slug", slug);
  await cleanUp();
});

test("the region's countries are added with one button and saved", async ({ page }) => {
  await signIn(page, email, "/admin");
  await page.goto("/admin/content/new");
  await page.getByLabel("Title").fill(`E2E ${slug}`);
  await page.getByLabel("URL (slug)").fill(slug);
  await page.getByLabel("Category").selectOption("Society");
  await page.getByLabel(/^Header – lead text( \*)?$/).fill("Region countries e2e.");

  // No region, no button.
  const shortcut = page.getByRole("button", { name: /^Add all \d+ countr(y|ies) of / });
  await expect(shortcut).toHaveCount(0);

  await page.getByLabel("Region", { exact: true }).selectOption({ index: 1 });
  await expect(shortcut).toBeVisible();
  const count = Number((await shortcut.textContent())?.match(/\d+/)?.[0]);
  expect(count).toBeGreaterThan(0);
  await shortcut.click();

  const chips = page.getByRole("list", { name: "Selected countries" }).getByRole("listitem");
  await expect(chips).toHaveCount(count);
  await expect(page.getByText(/^Added \d+ countr(y|ies) of /)).toBeVisible();
  await expect(page.getByRole("button", { name: /^All countries of .+ added$/ })).toBeDisabled();

  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(/\/admin\/content\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const { data } = await service
    .from("entries")
    .select("entry_countries(country_iso3)")
    .eq("slug", slug)
    .single();
  expect(data?.entry_countries).toHaveLength(count);
});
