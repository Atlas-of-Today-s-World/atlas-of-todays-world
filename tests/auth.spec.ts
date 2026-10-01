import { expect, test } from "@playwright/test";
import {
  cleanUp,
  createUser,
  invite,
  requireDevAccounts,
  service as admin,
  signIn,
  testEmail,
} from "./support/accounts";

/** Sign-in and invitations with real accounts (PLAN C8) — against atlas-dev only. */
requireDevAccounts();
test.afterAll(cleanUp);

test.describe("accounts and invitations", () => {
  test("reader signs in but may not enter the admin", async ({ page }) => {
    const email = testEmail("reader");
    await createUser(email);
    await signIn(page, email);

    await expect(page).toHaveURL(/\/ucet$/);
    await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
    await expect(page.getByRole("definition").filter({ hasText: email })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open the administration" })).toHaveCount(0);

    await page.goto("/admin");
    await expect(page.getByTestId("admin-forbidden")).toBeVisible();
  });

  test("invited publisher gets the role and sees only its sections", async ({ page }) => {
    const email = testEmail("publisher");
    await invite(email, "publisher");
    await createUser(email);
    await signIn(page, email);

    // An accepted invitation sends the user straight to the admin.
    await expect(page).toHaveURL(/\/admin$/);
    const nav = page.getByRole("navigation", { name: "Administration" });
    await expect(page.getByText(`${email} · Article writer`)).toBeVisible();
    // The menu lists only sections the role has the "v" (view) right for.
    await expect(nav.getByRole("link", { name: "Articles" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Accounts & invitations" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Roles & permissions" })).toHaveCount(0);

    // The section is protected outside the menu too.
    await page.goto("/admin/accounts/invitations");
    await expect(page.getByTestId("section-forbidden")).toBeVisible();

    const { data: invitation } = await admin
      .from("invitations")
      .select("accepted_at")
      .eq("email", email)
      .single();
    expect(invitation?.accepted_at).not.toBeNull();
  });

  test("invitation for a different e-mail cannot be accepted", async ({ page }) => {
    const invited = testEmail("invited");
    const intruder = testEmail("intruder");
    await invite(invited, "publisher");
    await createUser(intruder);
    await signIn(page, intruder);

    await expect(page).toHaveURL(/\/ucet$/);
    await page.goto("/admin");
    await expect(page.getByTestId("admin-forbidden")).toBeVisible();

    const { data: invitation } = await admin
      .from("invitations")
      .select("accepted_at")
      .eq("email", invited)
      .single();
    expect(invitation?.accepted_at).toBeNull();
  });

  test("sign-out ends the session", async ({ page }) => {
    const email = testEmail("signout");
    await createUser(email);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/ucet$/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/ucet");
    await expect(page).toHaveURL(/\/login\?next=%2Fucet/);
  });

  test("reader downloads own data (GDPR), anonymous cannot", async ({ page, request }) => {
    expect((await request.get("/api/account/export")).status()).toBe(401);
    const email = testEmail("export");
    await createUser(email);
    await signIn(page, email);
    await expect(page.getByRole("link", { name: "Download my data" })).toBeVisible();
    const response = await page.request.get("/api/account/export");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-disposition"]).toMatch(/attachment/);
    const data = await response.json();
    expect(data.account.email).toBe(email);
    expect(data.profile).toMatchObject({ email, kind: "reader" });
  });
});
