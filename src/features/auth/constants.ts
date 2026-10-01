/**
 * Email sign-in constants and types without Zod — a client component (the
 * form) may import them without pulling validation into the browser.
 */

/** Length of the email code — matches `otp_length` in supabase/config.toml. */
export const EMAIL_CODE_LENGTH = 6;

/** Email language (templates in supabase/templates read `.Data.locale`). */
export const EMAIL_LOCALES = ["en", "cs"] as const;

/**
 * Result of email sign-in actions. Errors are codes, not sentences — reader-facing
 * texts belong in translations (src/messages); the form picks them itself.
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
  /** Which email the code was sent to (the form then shows the code field). */
  email?: string;
}
