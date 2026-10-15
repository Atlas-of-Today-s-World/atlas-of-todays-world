import "server-only";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { clientIp } from "./ip";

/**
 * Cloudflare Turnstile for the public forms (newsletter, volunteer application;
 * audit S-L7). The e-mail sign-in has its own check in Supabase Auth.
 *
 * On only when both keys are set: the public site key (widget) and the secret
 * (server-side check). Without the secret the forms render no widget and
 * accept submissions as before. Pages read `captchaEnabled()` at build time,
 * so deploy.yml passes the secret to the build as well as to the runtime.
 *
 * Availability first (owner): when Cloudflare can't be asked (network error,
 * timeout, HTTP error, unreadable answer) or says our secret is wrong, the
 * submission goes through and the problem is logged. A token Cloudflare
 * explicitly rejects (missing, invalid, expired, reused) always fails.
 */

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
/** Short: the visitor waits for it, and a slow Cloudflare lets the form through anyway. */
const TIMEOUT_MS = 3000;
/** Cloudflare's own limit for a token. */
const MAX_TOKEN_LENGTH = 2048;
/** The field the widget adds to its form. */
const TOKEN_FIELD = "cf-turnstile-response";
/** Answers about our configuration or Cloudflare itself, not about the visitor's token. */
const NOT_THE_VISITOR = new Set(["missing-input-secret", "invalid-input-secret", "internal-error"]);

/** Both keys are set: forms render the widget and require a valid token. */
export function captchaEnabled(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY && serverEnv.TURNSTILE_SECRET_KEY);
}

/**
 * Asks Cloudflare whether a widget token is valid. `true` = let the request
 * through (valid, or Cloudflare unavailable), `false` = rejected.
 */
export async function verifyTurnstile(token: string, ip: string | undefined): Promise<boolean> {
  const secret = serverEnv.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token || token.length > MAX_TOKEN_LENGTH) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  let answer: { success?: unknown; "error-codes"?: unknown };
  try {
    const response = await fetch(SITEVERIFY, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return unavailable(`HTTP ${response.status}`);
    answer = (await response.json()) as typeof answer;
  } catch (error) {
    return unavailable(error instanceof Error ? error.name : "unknown error");
  }
  if (answer.success === true) return true;
  const codes = Array.isArray(answer["error-codes"]) ? answer["error-codes"] : [];
  if (codes.some((code) => NOT_THE_VISITOR.has(String(code)))) {
    return unavailable(codes.join(", "));
  }
  return false;
}

/** A public form passes the check: always when it is off, else by its widget token. */
export async function passesCaptcha(formData: FormData, headers: Headers): Promise<boolean> {
  if (!captchaEnabled()) return true;
  return verifyTurnstile(String(formData.get(TOKEN_FIELD) ?? ""), clientIp(headers));
}

function unavailable(reason: string): true {
  console.error(`[turnstile] siteverify failed (${reason}); letting the request through`);
  return true;
}
