import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { test, type Page } from "@playwright/test";

/**
 * Testovací účty pro e2e proti atlas-dev (nikdy produkce).
 *
 * Google se obchází: Auth Admin API vygeneruje magic link a prohlížeč projde
 * naší routou /auth/confirm, která stejně jako návrat z Google ověří session
 * a zavolá claim_invitation(). Bez servisního klíče dev projektu (fork,
 * Dependabot) se sada přeskočí.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // v CI jdou hodnoty z prostředí
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROD_REF = "ewbzkxialhtwuqlenjof";

/** Přeskočí sadu bez dev projektu, v produkci a na mobilním projektu. */
export function requireDevAccounts() {
  test.skip(!url || !serviceKey, "chybí Supabase dev projekt (URL + servisní klíč)");
  test.skip(Boolean(url?.includes(PROD_REF)), "e2e účty se nikdy nezakládají v produkci");
  // Toky nezávisí na velikosti okna; stačí jeden projekt.
  test.skip(({ isMobile }) => isMobile, "jen desktop");
}

export const service = (
  url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null
) as SupabaseClient;

const created: string[] = [];

export function testEmail(label: string) {
  return `e2e-${label}-${randomUUID().slice(0, 8)}@example.com`;
}

/** Ověřený účet, jako by se právě přihlásil přes Google; volitelně rovnou s rolí. */
export async function createUser(email: string, roleId?: string) {
  const { data, error } = await service.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  created.push(data.user.id);
  if (roleId) {
    const { error: roleError } = await service
      .from("profiles")
      .update({ role_id: roleId, kind: roleId === "reader" ? "reader" : "staff" })
      .eq("id", data.user.id);
    if (roleError) throw roleError;
  }
  return data.user;
}

export async function invite(email: string, roleId: string) {
  const { error } = await service.from("invitations").insert({ email, role_id: roleId });
  if (error) throw error;
}

/** Přihlášení přes jednorázový odkaz → /auth/confirm (stejná cesta jako e-mail). */
export async function signIn(page: Page, email: string, next = "/ucet") {
  const { data, error } = await service.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const params = new URLSearchParams({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
    next,
  });
  await page.goto(`/auth/confirm?${params}`);
}

/** Úklid po sadě: testovací účty, pozvánky a články s předponou e2e-. */
export async function cleanUp() {
  await service.from("entries").delete().like("slug", "e2e-%");
  for (const id of created.splice(0)) await service.auth.admin.deleteUser(id);
  await service.from("invitations").delete().like("email", "e2e-%@example.com");
}
