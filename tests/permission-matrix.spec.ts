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
 * Permission matrix (role × section × vced): every click is saved at once via
 * the `saveMatrix` Server Action and the DB decides. A temporary "permission
 * manager" role without mandatory 2FA edits a temporary target role; admin and
 * the manager's own role are locked.
 */
requireDevAccounts();
test.describe.configure({ mode: "serial" });

const run = randomUUID().slice(0, 8);
const managerRole = `e2e-perm-${run}`;
const targetRole = `e2e-target-${run}`;
const targetName = `E2E target ${run}`;
const managerName = `E2E permissions ${run}`;

test.beforeAll(async () => {
  const { error } = await service.from("roles").insert([
    { id: managerRole, name: managerName, note: "Dočasná role e2e testu." },
    { id: targetRole, name: targetName, note: "Dočasná role e2e testu." },
  ]);
  if (error) throw error;
  const { error: permError } = await service
    .from("role_permissions")
    .insert({ role_id: managerRole, section: "permissions", actions: "vced" });
  if (permError) throw permError;
});

test.afterAll(async () => {
  await cleanUp();
  await service.from("role_permissions").delete().in("role_id", [managerRole, targetRole]);
  await service.from("roles").delete().in("id", [managerRole, targetRole]);
});

const newsOf = async (role: string) =>
  (
    await service
      .from("role_permissions")
      .select("actions")
      .eq("role_id", role)
      .eq("section", "news")
      .maybeSingle()
  ).data?.actions ?? "";

test("one click saves a permission; admin and own role stay locked", async ({ page }) => {
  const email = testEmail("perm");
  await createUser(email, managerRole);
  await signIn(page, email, "/admin/roles");

  const matrix = page.getByRole("table", { name: "Permissions of roles by section" });
  await expect(
    matrix.getByRole("checkbox", { name: "View – Articles – Administrator" }),
  ).toBeDisabled();
  await expect(
    matrix.getByRole("checkbox", { name: `View – Articles – ${managerName}` }),
  ).toBeDisabled();

  // Edit without view is not a thing: the click adds view too.
  await matrix.getByRole("checkbox", { name: `Edit – Articles – ${targetName}` }).check();
  await expect.poll(() => newsOf(targetRole)).toBe("ve");

  // The saved state stays on screen (no flicker back while the page refreshes).
  await expect(
    matrix.getByRole("checkbox", { name: `View – Articles – ${targetName}` }),
  ).toBeChecked();

  // Removing view removes the section.
  await matrix.getByRole("checkbox", { name: `View – Articles – ${targetName}` }).uncheck();
  await expect.poll(() => newsOf(targetRole)).toBe("");
  await expect(
    matrix.getByRole("checkbox", { name: `Edit – Articles – ${targetName}` }),
  ).not.toBeChecked();
});
