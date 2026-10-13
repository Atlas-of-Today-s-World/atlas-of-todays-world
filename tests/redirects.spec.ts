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
 * G3: a redirect added in the admin applies at once (cache refresh) — both for
 * an old country URL and for a path that does not exist on the site at all —
 * and so does editing one. Also the operations screen (switches & the
 * maintenance message) as a site-content editor sees it. Maintenance itself is
 * never switched on here: it would take the shared atlas-dev site down for
 * every other test running at the same time.
 */
requireDevAccounts();
test.describe.configure({ mode: "serial" });

const run = randomUUID().slice(0, 8);
const oldCountry = `/country/e2e-stara-${run}`;
const oldPath = `/e2e-stara-cesta-${run}`;

test.afterAll(async () => {
  await service.from("redirects").delete().like("from_path", `%e2e-stara%${run}`);
  await cleanUp();
});

test("editors add a redirect and the visitor lands on the new URL", async ({ page, browser }) => {
  const admin = testEmail("redirects");
  // Redirects belong to the news section; admin would require TOTP (MfaGate).
  await createUser(admin, "content-editor");
  await signIn(page, admin, "/admin");
  await page.goto("/admin/redirects");

  for (const [from, to] of [
    [oldCountry, "/country/ukraine"],
    [oldPath, "/about"],
  ] as const) {
    await page.getByLabel(/^Old path( \*)?$/).fill(from);
    await page.getByLabel(/^New path( \*)?$/).fill(to);
    await page.getByRole("button", { name: "Add redirect" }).click();
    await expect(page.getByRole("cell", { name: from })).toBeVisible();
  }

  const visitor = await (await browser.newContext()).newPage();
  // A real HTTP redirect (layout runs before streaming), not a meta refresh.
  const response = await visitor.request.get(oldCountry, { maxRedirects: 0 });
  expect([307, 308]).toContain(response.status());
  expect(response.headers().location).toMatch(/\/country\/ukraine$/);
  await visitor.goto(oldCountry);
  await expect(visitor).toHaveURL(/\/country\/ukraine$/);
  await visitor.goto(oldPath);
  await expect(visitor).toHaveURL(/\/about$/);

  // Editing an existing redirect (news "e") applies at once as well.
  await page
    .getByRole("row")
    .filter({ hasText: oldPath })
    .getByRole("link", { name: "Edit" })
    .click();
  await expect(page.getByRole("heading", { name: "Edit URL redirect" })).toBeVisible();
  await page.getByLabel(/^New path( \*)?$/).fill("/countries");
  await page.getByRole("button", { name: "Save redirect" }).click();
  await expect(page.getByRole("status")).toContainText("Redirect saved");
  await visitor.goto(oldPath);
  await expect(visitor).toHaveURL(/\/countries$/);

  // The redirects built into the site are listed, read-only.
  await page.goto("/admin/redirects");
  await page.getByText(/^Built-in redirects/).click();
  await expect(
    page.getByTestId("built-in-redirects").getByRole("cell", { name: "/special/:slug" }),
  ).toBeVisible();
});

test("a content editor sees the switches read-only and may word the maintenance notice", async ({
  page,
}) => {
  const editor = testEmail("switches");
  await createUser(editor, "content-editor");
  await signIn(page, editor, "/admin/switches");
  await expect(page.getByRole("heading", { name: "Switches & maintenance" })).toBeVisible();
  // Switches are a permissions "e" right: no toggle for site content editors.
  await expect(page.getByRole("cell", { name: "maintenance", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Turn (on|off)$/ })).toHaveCount(0);
  // The wording is site content ("site" "e").
  await expect(page.getByLabel("Title", { exact: true })).toBeEditable();
});
