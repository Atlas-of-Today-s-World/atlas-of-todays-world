import "server-only";
import { createHash, createHmac } from "node:crypto";
import { serverEnv } from "@/lib/env.server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimitAddress } from "./ip";

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
  const ip = rateLimitAddress(headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown");
  return allowKey(
    `${scope}:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`,
    limits,
    {
      failClosed: FAIL_CLOSED_SCOPES.has(scope),
    },
  );
}

/** Scopes where a failing limit store refuses the request instead of letting it through. */
const FAIL_CLOSED_SCOPES = new Set(["email-code", "email-verify", "newsletter", "volunteer"]);

/**
 * A limit per email address, whichever IP the requests come from (e.g. code
 * attempts for one account). The address is stored only as a keyed hash, and
 * an outage of the store always refuses — it guards sign-in.
 */
export async function allowEmail(scope: string, email: string, limits: Limits): Promise<boolean> {
  const hash = createHmac("sha256", serverEnv.SUPABASE_SERVICE_ROLE_KEY ?? "")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
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
