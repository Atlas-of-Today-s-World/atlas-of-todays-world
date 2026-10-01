import { z } from "zod";
import { emailAddress } from "@/lib/validation/common";

/** Délka kódu z e-mailu — shodná s `otp_length` v supabase/config.toml. */
export const EMAIL_CODE_LENGTH = 6;

/** Jazyk e-mailu (šablony v supabase/templates čtou `.Data.locale`). */
const EMAIL_LOCALES = ["en", "cs"] as const;

/** Kam po přihlášení — cestu ověří až `safeRedirect`, tady jen délka. */
const next = z.string().max(500).optional();

/** Krok 1: e-mail, na který přijde kód (G1). */
export const EmailCodeRequest = z.object({
  email: emailAddress,
  next,
  locale: z.enum(EMAIL_LOCALES).default("en"),
  // Token z Cloudflare Turnstile; ověřuje ho Supabase Auth (captcha), když je zapnutá.
  captchaToken: z.string().max(4000).optional(),
});

/** Krok 2: kód z e-mailu. */
export const EmailCodeVerify = z.object({
  email: emailAddress,
  code: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${EMAIL_CODE_LENGTH}}$`)),
  next,
});

/**
 * Výsledek akcí přihlášení e-mailem. Chyby jsou kódy, ne věty — texty pro
 * čtenáře patří do překladů (src/messages), formulář si je vybere sám.
 */
type EmailAuthError =
  | "disabled"
  | "invalid_email"
  | "invalid_code"
  | "rate_limited"
  | "captcha"
  | "send_failed"
  | "wrong_code";

export interface EmailCodeState {
  ok: boolean;
  error?: EmailAuthError;
  /** Na jaký e-mail kód odešel (formulář pak ukáže pole pro kód). */
  email?: string;
}
