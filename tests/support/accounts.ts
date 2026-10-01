import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { test, type Page } from "@playwright/test";

/**
 * Test accounts for e2e against atlas-dev (never production).
 *
 * Google is bypassed: the Auth Admin API generates a magic link and the browser
 * goes through our /auth/confirm route, which, like the return from Google,
 * verifies the session and calls claim_invitation(). Without the dev project's
 * service key (fork, Dependabot) the suite is skipped.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // in CI the values come from the environment
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROD_REF = "ewbzkxialhtwuqlenjof";

/** Skips the suite without a dev project, in production and on the mobile project. */
export function requireDevAccounts() {
  test.skip(!url || !serviceKey, "missing Supabase dev project (URL + service key)");
  test.skip(Boolean(url?.includes(PROD_REF)), "e2e accounts are never created in production");
  // The flows do not depend on viewport size; one project is enough.
  test.skip(({ isMobile }) => isMobile, "jen desktop");
}

export const service = (
  url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null
) as SupabaseClient;

const created: string[] = [];
const invited: string[] = [];

export function testEmail(label: string) {
  return `e2e-${label}-${randomUUID().slice(0, 8)}@example.com`;
}

/** A verified account, as if just signed in via Google; optionally with a role. */
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
  invited.push(email);
}

/** Sign-in via a one-time link → /auth/confirm (same path as the e-mail). */
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

/**
 * Cleanup after the suite: only what this suite created (its accounts' articles,
 * its invitations, accounts). Suites run concurrently in several CI workers —
 * blanket deletion by the e2e- prefix would delete another suite's in-flight data.
 */
export async function cleanUp() {
  const users = created.splice(0);
  if (users.length) await service.from("entries").delete().in("owner_id", users);
  for (const id of users) await service.auth.admin.deleteUser(id);
  const emails = invited.splice(0);
  if (emails.length) await service.from("invitations").delete().in("email", emails);
}
