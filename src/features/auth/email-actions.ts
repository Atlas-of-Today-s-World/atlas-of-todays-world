"use server";

import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getFlags } from "@/features/flags/queries";
import { allowEmail, allowRequest } from "@/lib/security/rate-limit";
import { createServerClient } from "@/lib/supabase/server";
import { signInDestination } from "./sign-in";
import type { EmailCodeState } from "./constants";
import { EmailCodeRequest, EmailCodeVerify } from "./schema";

/** How many codes one IP address may request (on top of Supabase Auth limits). */
const REQUEST_LIMIT = { limit: 5, windowSeconds: 600 };
/** How many code attempts from one IP address — six digits must not be guessable. */
const VERIFY_LIMIT = { limit: 10, windowSeconds: 600 };
/**
 * How many code attempts for one email address from anywhere — guesses spread
 * over many IP addresses still meet this limit.
 */
const VERIFY_PER_EMAIL_LIMIT = { limit: 5, windowSeconds: 900 };

/**
 * Sign-in with an email code, step 1 (G1): sends a six-digit code. A reader
 * account is created on first sign-in (role reader, ARCHITEKTURA 7); only
 * someone invited by an admin joins the team (a verified email accepts the invitation).
 * Disabled by the `email_auth` flag until we have our own SMTP (U5).
 */
export async function requestEmailCode(
  _prev: EmailCodeState,
  formData: FormData,
): Promise<EmailCodeState> {
  if (!(await getFlags()).emailAuth) return { ok: false, error: "disabled" };
  const parsed = EmailCodeRequest.safeParse({
    email: formData.get("email"),
    next: formData.get("next") ?? undefined,
    locale: formData.get("locale") ?? undefined,
    captchaToken: formData.get("cf-turnstile-response") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "invalid_email" };
  if (!(await allowRequest("email-code", await headers(), REQUEST_LIMIT))) {
    return { ok: false, error: "rate_limited" };
  }

  const { email, locale, captchaToken } = parsed.data;
  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, captchaToken, data: { locale } },
  });
  if (error) {
    console.error("[email-code]", error.code ?? error.message);
    return { ok: false, error: error.code === "captcha_failed" ? "captcha" : "send_failed" };
  }
  // The response is the same for existing and new accounts — reveals nothing about who is registered.
  return { ok: true, email };
}

/** Step 2: verifies the code, signs in and redirects (an invited team member to the admin). */
export async function verifyEmailCode(
  _prev: EmailCodeState,
  formData: FormData,
): Promise<EmailCodeState> {
  if (!(await getFlags()).emailAuth) return { ok: false, error: "disabled" };
  const parsed = EmailCodeVerify.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
    next: formData.get("next") ?? undefined,
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { ok: false, error: "invalid_code", email };
  if (
    !(await allowRequest("email-verify", await headers(), VERIFY_LIMIT)) ||
    !(await allowEmail("email-verify-address", parsed.data.email, VERIFY_PER_EMAIL_LIMIT))
  ) {
    return { ok: false, error: "rate_limited", email };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: "email",
  });
  if (error) return { ok: false, error: "wrong_code", email };
  redirect(await signInDestination(supabase, parsed.data.next ?? null));
}
