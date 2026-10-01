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

/** Přihlášení a pozvánky se skutečnými účty (PLAN C8) — jen proti atlas-dev. */
requireDevAccounts();
test.afterAll(cleanUp);

test.describe("účty a pozvánky", () => {
  test("čtenář se přihlásí, ale do administrace nesmí", async ({ page }) => {
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

  test("pozvaný publisher dostane roli a vidí jen své sekce", async ({ page }) => {
    const email = testEmail("publisher");
    await invite(email, "publisher");
    await createUser(email);
    await signIn(page, email);

    // Přijatá pozvánka posílá rovnou do administrace.
    await expect(page).toHaveURL(/\/admin$/);
    const nav = page.getByRole("navigation", { name: "Administrace" });
    await expect(page.getByText(`${email} · Publisher`)).toBeVisible();
    // Menu jen ze sekcí, na které role má právo „v".
    await expect(nav.getByRole("link", { name: "Novinky a hesla" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Účty a pozvánky" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Role a práva" })).toHaveCount(0);

    // Sekce je chráněná i mimo menu.
    await page.goto("/admin/ucty/pozvanky");
    await expect(page.getByTestId("section-forbidden")).toBeVisible();

    const { data: invitation } = await admin
      .from("invitations")
      .select("accepted_at")
      .eq("email", email)
      .single();
    expect(invitation?.accepted_at).not.toBeNull();
  });

  test("pozvánku na jiný e-mail nejde přijmout", async ({ page }) => {
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

  test("odhlášení ukončí session", async ({ page }) => {
    const email = testEmail("signout");
    await createUser(email);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/ucet$/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/ucet");
    await expect(page).toHaveURL(/\/login\?next=%2Fucet/);
  });

  test("čtenář si stáhne svá data (GDPR), anonym ne", async ({ page, request }) => {
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
