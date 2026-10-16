import "server-only";
import { createHash, createHmac } from "node:crypto";
import { serverEnv } from "@/lib/env.server";
import { createServiceClient } from "@/lib/supabase/service";
import { clientIp, rateLimitAddress } from "./ip";

type Limits = { limit: number; windowSeconds: number };

/**
 * Rate limit in shared storage (Postgres `rate_limits`, ARCHITEKTURA 8.4) —
 * applies to all instances at once. The address is stored only as a hash.
 *
 * Without a service key (local development) there is no limit; in production the key is set.
 * When the limit store fails, sign-in codes and public forms that send mail or
 * write rows are refused (an outage must not open unlimited code guessing or
 * mail sending); search and the rest go on.
 */
export async function allowRequest(
  scope: string,
  headers: Headers,
  limits: Limits,
): Promise<boolean> {
  const ip = rateLimitAddress(clientIp(headers) ?? "unknown");
  return allowKey(`${scope}:${keyHash(ip, null)}`, limits, {
    failClosed: FAIL_CLOSED_SCOPES.has(scope),
  });
}

/**
 * Hash of an address for a rate-limit key: HMAC-SHA-256 with `RATE_LIMIT_SECRET`,
 * so the stored keys can't be reversed by hashing every IPv4 address or a list
 * of e-mails. Until that secret is set, the previous derivation (`legacyKey`:
 * null = plain SHA-256 for IPs, the service key for e-mails), so existing
 * windows keep counting.
 */
function keyHash(value: string, legacyKey: string | null): string {
  const secret = serverEnv.RATE_LIMIT_SECRET ?? legacyKey;
  const digest = secret === null ? createHash("sha256") : createHmac("sha256", secret);
  return digest.update(value).digest("hex").slice(0, 32);
}

/** Scopes where a failing limit store refuses the request instead of letting it through. */
const FAIL_CLOSED_SCOPES = new Set([
  "email-code",
  "email-verify",
  "newsletter",
  "volunteer",
  // Conversion counter (/api/e): it writes rows, so an outage drops events.
  "event",
]);

/**
 * A limit per email address, whichever IP the requests come from (e.g. code
 * attempts for one account). The address is stored only as a keyed hash, and
 * an outage of the store always refuses — it guards sign-in.
 */
export async function allowEmail(scope: string, email: string, limits: Limits): Promise<boolean> {
  const hash = keyHash(email.trim().toLowerCase(), serverEnv.SUPABASE_SERVICE_ROLE_KEY ?? "");
  return allowKey(`${scope}:${hash}`, limits, { failClosed: true });
}

/**
 * The same limit for any key (e.g. one IndexNow ping per URL in a window).
 * The key must not contain personal data — hash it first.
 */
export async function allowKey(
  key: string,
  { limit, windowSeconds }: Limits,
  { failClosed = false }: { failClosed?: boolean } = {},
): Promise<boolean> {
  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    if (process.env.VERCEL_ENV === "production") {
      console.error("[rate-limit] SUPABASE_SERVICE_ROLE_KEY is missing in production");
    }
    return true;
  }
  const { data, error } = await createServiceClient().rpc("hit_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    // An outage must not break search or pings, but never opens sign-in codes.
    console.error("[rate-limit]", error.message);
    return !failClosed;
  }
  return data === true;
}
