/**
 * Konstanty a typy přihlášení e-mailem bez Zodu — smí je importovat i
 * klientská komponenta (formulář), aniž by do prohlížeče táhla validaci.
 */

/** Délka kódu z e-mailu — shodná s `otp_length` v supabase/config.toml. */
export const EMAIL_CODE_LENGTH = 6;

/** Jazyk e-mailu (šablony v supabase/templates čtou `.Data.locale`). */
export const EMAIL_LOCALES = ["en", "cs"] as const;

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
