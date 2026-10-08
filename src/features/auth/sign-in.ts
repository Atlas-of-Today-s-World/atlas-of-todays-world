import "server-only";
import { NextResponse } from "next/server";
import { splitLocale } from "@/features/i18n/config";
import { safeRedirect } from "@/lib/security/redirect";
import type { createServerClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createServerClient>>;

const DEFAULT_AFTER_SIGN_IN = "/ucet";

/** The page an e-mail link leads to; its button posts the token to /auth/confirm. */
export const CONFIRM_PAGE = "/login/confirm";

/**
 * Finishing sign-in (Google and email link): accepts a pending invitation
 * and redirects the user onward — only within our own site.
 *
 * The invitation is often already accepted by a trigger on account creation, so
 * the destination isn't decided by the result of `claim_invitation()` but by the
 * role: a team member without a specific destination goes straight to the admin.
 * 303, so a sign-in finished by a form post continues with a GET.
 */
export async function finishSignIn(supabase: Client, next: string | null, origin: string) {
  return NextResponse.redirect(new URL(await signInDestination(supabase, next), origin), 303);
}

/** Where to go after sign-in — for the route handler (finishSignIn) and the email-code Server Action. */
export async function signInDestination(supabase: Client, next: string | null) {
  const target = safeRedirect(next, DEFAULT_AFTER_SIGN_IN);
  await supabase.rpc("claim_invitation");

  // Default destination in any language (/ucet, /cs/ucet) = the team member has nowhere else to go.
  if (splitLocale(target).path === DEFAULT_AFTER_SIGN_IN) {
    const { data: role } = await supabase.rpc("my_role");
    if (role && role.id !== "reader") return "/admin";
  }
  return target;
}

export function signInFailed(origin: string) {
  return NextResponse.redirect(new URL("/login?error=callback", origin), 303);
}
