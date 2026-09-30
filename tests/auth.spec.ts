import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

/**
 * Přihlášení a pozvánky se skutečnými účty (PLAN C8) — jen proti atlas-dev.
 *
 * Google se v testu obchází: Auth Admin API vygeneruje magic link a prohlížeč
 * projde naší routou /auth/confirm, která stejně jako návrat z Google ověří
 * session a zavolá claim_invitation(). Bez servisního klíče dev projektu
 * (fork, Dependabot) se sada přeskočí.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // v CI jdou hodnoty z prostředí
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROD_REF = "ewbzkxialhtwuqlenjof";

test.skip(!url || !serviceKey, "chybí Supabase dev projekt (URL + servisní klíč)");
test.skip(Boolean(url?.includes(PROD_REF)), "e2e účty se nikdy nezakládají v produkci");
// Toky nezávisí na velikosti okna; stačí jeden projekt.
test.skip(({ isMobile }) => isMobile, "jen desktop");

const admin = (
  url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null
) as SupabaseClient;

const created: string[] = [];

function testEmail(label: string) {
  return `e2e-${label}-${randomUUID().slice(0, 8)}@example.com`;
}

/** Ověřený účet, jako by se právě přihlásil přes Google. */
async function createUser(email: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  created.push(data.user.id);
  return data.user;
}

async function invite(email: string, roleId: string) {
  const { error } = await admin.from("invitations").insert({ email, role_id: roleId });
  if (error) throw error;
}

/** Přihlášení přes jednorázový odkaz → /auth/confirm (stejná cesta jako e-mail). */
async function signIn(page: Page, email: string, next = "/ucet") {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const params = new URLSearchParams({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
    next,
  });
  await page.goto(`/auth/confirm?${params}`);
}

test.afterAll(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id);
  await admin.from("invitations").delete().like("email", "e2e-%@example.com");
});

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
    await expect(nav.getByText("Publisher")).toBeVisible();
    await expect(nav.getByRole("link", { name: "Tým a pozvánky" })).toHaveCount(0);

    await page.goto("/admin/pozvanky");
    await expect(page.getByText("Na správu týmu nemáte oprávnění.")).toBeVisible();

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
});
