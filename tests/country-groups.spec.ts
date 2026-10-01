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
 * Skupiny zemí v administraci: vlastní region složený z vybraných zemí
 * (vedle globálních témat). Data-editor má právo na skupiny i regiony.
 */
requireDevAccounts();
test.describe.configure({ mode: "serial" });

const run = randomUUID().slice(0, 8);
const name = `E2E region ${run}`;
const slug = `e2e-region-${run}`;
let email = "";

test.beforeAll(async () => {
  email = testEmail("groups");
  await createUser(email, "data-editor");
});

test.afterAll(async () => {
  if (!service) return;
  await service.from("special_regions").delete().eq("slug", slug);
  await cleanUp();
});

test("vlastní region: založení ze zemí, typ v seznamu a sekce článků", async ({ page }) => {
  await signIn(page, email, "/admin/global-issues");
  await expect(page.getByRole("heading", { level: 1, name: "Country groups" })).toBeVisible();

  await page.getByRole("link", { name: "New custom region" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "New custom region" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Custom region/ })).toBeChecked();

  await page.getByLabel("Name").fill(name);
  await expect(page.getByLabel("URL (slug)")).toHaveValue(slug);
  for (const country of ["Czechia", "Poland"]) {
    await page.getByPlaceholder("Add a country…").fill(country);
    await page.getByRole("option", { name: country }).first().click();
  }
  await page.getByRole("button", { name: "Create custom region" }).click();

  await page.waitForURL(`**/admin/global-issues/${slug}`);
  await expect(page.getByText("Custom region.", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Articles in this group" })).toBeVisible();

  const { data } = await service
    .from("special_regions")
    .select("kind, special_region_countries(country_iso3)")
    .eq("slug", slug)
    .single();
  expect(data?.kind).toBe("region");
  expect(data?.special_region_countries.map((row) => row.country_iso3).sort()).toEqual([
    "CZE",
    "POL",
  ]);

  await page.goto("/admin/global-issues");
  const row = page.getByRole("row", { name });
  await expect(row).toContainText("Custom region");
});
