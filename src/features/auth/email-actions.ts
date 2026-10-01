"use server";

import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getFlags } from "@/features/flags/queries";
import { allowRequest } from "@/lib/security/rate-limit";
import { createServerClient } from "@/lib/supabase/server";
import { signInDestination } from "./sign-in";
import type { EmailCodeState } from "./constants";
import { EmailCodeRequest, EmailCodeVerify } from "./schema";

/** Kolik kódů smí jedna IP adresa vyžádat (vedle limitů Supabase Auth). */
const REQUEST_LIMIT = { limit: 5, windowSeconds: 600 };
/** Kolik pokusů o kód z jedné IP adresy — šest číslic se nesmí dát uhodnout. */
const VERIFY_LIMIT = { limit: 10, windowSeconds: 600 };

/**
 * Přihlášení kódem z e-mailu, krok 1 (G1): pošle šestimístný kód. Účet
 * čtenáře vznikne při prvním přihlášení (role reader, ARCHITEKTURA 7);
 * do týmu se dostane jen ten, koho admin pozval (pozvánku přijme ověřený e-mail).
 * Vypnuté přepínačem `email_auth`, dokud nemáme vlastní SMTP (U5).
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
  // Odpověď je stejná pro existující i nový účet — nic neprozradí, kdo je registrovaný.
  return { ok: true, email };
}

/** Krok 2: ověří kód, přihlásí a pošle dál (pozvaného člena týmu do administrace). */
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
  if (!(await allowRequest("email-verify", await headers(), VERIFY_LIMIT))) {
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
