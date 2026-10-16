import { expect, test, type Page } from "@playwright/test";
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

/** Opens the header's account menu (desktop) and waits until it has loaded. */
async function openAccountMenu(page: Page) {
  await page.getByRole("button", { name: "Sign in or open your account" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByText("Loading…")).toHaveCount(0);
  return menu;
}

test.describe("accounts and invitations", () => {
  test("reader signs in but may not enter the admin", async ({ page }) => {
    const email = testEmail("reader");
    await createUser(email);
    await signIn(page, email);

    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole("heading", { name: "Account settings" })).toBeVisible();
    await expect(page.getByRole("definition").filter({ hasText: email })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download my data" })).toBeVisible();
    // Deleting is collapsed until opened.
    await expect(page.getByRole("button", { name: "Delete my account" })).toBeHidden();

    // The header's account menu: e-mail, Account settings, Sign out — no admin.
    await page.goto("/about");
    const menu = await openAccountMenu(page);
    await expect(menu.getByText(email)).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Account settings" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Open the administration" })).toHaveCount(0);
    await menu.getByRole("menuitem", { name: "Account settings" }).click();
    await expect(page).toHaveURL(/\/account$/);

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
    await expect(nav.getByRole("link", { name: "Topics & news" })).toBeVisible();
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

    // The header's account menu offers the admin and My account (admin).
    await page.goto("/about");
    const menu = await openAccountMenu(page);
    await expect(menu.getByText("Article writer")).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Open the administration" })).toBeVisible();
    await menu.getByRole("menuitem", { name: "My account" }).click();
    await expect(page).toHaveURL(/\/admin\/account$/);
    await expect(page.getByRole("heading", { name: "My account" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download my data" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "My account" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    // The reader's settings page sends the team to the admin's.
    await page.goto("/account");
    await expect(page).toHaveURL(/\/admin\/account$/);
  });

  test("invitation for a different e-mail cannot be accepted", async ({ page }) => {
    const invited = testEmail("invited");
    const intruder = testEmail("intruder");
    await invite(invited, "publisher");
    await createUser(intruder);
    await signIn(page, intruder);

    await expect(page).toHaveURL(/\/account$/);
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
    await expect(page).toHaveURL(/\/account$/);

    const menu = await openAccountMenu(page);
    await menu.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    // Signed out, the menu offers only signing in.
    await expect(
      (await openAccountMenu(page)).getByRole("menuitem", { name: "Sign in" }),
    ).toBeVisible();
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
  });

  test("session cookies are httpOnly — page scripts never see the session", async ({ page }) => {
    const email = testEmail("httponly");
    await createUser(email);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/account$/);

    const session = (await page.context().cookies()).filter((c) =>
      /^sb-.+-auth-token/.test(c.name),
    );
    expect(session.length).toBeGreaterThan(0);
    for (const cookie of session) expect(cookie.httpOnly, cookie.name).toBe(true);
    expect(await page.evaluate(() => document.cookie)).not.toContain("auth-token");
  });

  test("Google sign-in starts on the server with an httpOnly PKCE verifier", async ({ page }) => {
    // Stop at Supabase's authorize endpoint — the test never goes on to Google.
    await page.route(/\/auth\/v1\/authorize/, (route) =>
      route.fulfill({ status: 200, contentType: "text/plain", body: "authorize" }),
    );
    await page.goto("/login?next=%2Fadmin");
    const site = new URL(page.url()).origin;
    const authorize = page.waitForRequest(/\/auth\/v1\/authorize/);
    await page.getByRole("button", { name: "Continue with Google" }).click();
    const url = new URL((await authorize).url());

    expect(url.searchParams.get("provider")).toBe("google");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    const back = new URL(url.searchParams.get("redirect_to") ?? "");
    expect(back.origin).toBe(site);
    expect(back.pathname).toBe("/auth/callback");
    expect(back.searchParams.get("next")).toBe("/admin");

    const verifier = (await page.context().cookies()).find((c) =>
      c.name.endsWith("-code-verifier"),
    );
    expect(verifier?.httpOnly).toBe(true);
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
