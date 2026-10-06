import "server-only";
import { createHash } from "node:crypto";
import { serverEnv } from "@/lib/env.server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Rate limit in shared storage (Postgres `rate_limits`, ARCHITEKTURA 8.4) —
 * applies to all instances at once. The address is stored only as a hash.
 *
 * Without a service key (local development) there is no limit; in production the key is set.
 * When the limit store fails, sign-in codes are refused (an outage must not
 * open unlimited code guessing or mail sending); search and the rest go on.
 */
export async function allowRequest(
  scope: string,
  headers: Headers,
  limits: { limit: number; windowSeconds: number },
): Promise<boolean> {
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return allowKey(
    `${scope}:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`,
    limits,
    {
      failClosed: FAIL_CLOSED_SCOPES.has(scope),
    },
  );
}

/** Scopes where a failing limit store refuses the request instead of letting it through. */
const FAIL_CLOSED_SCOPES = new Set(["email-code", "email-verify"]);

/**
 * The same limit for any key (e.g. one IndexNow ping per URL in a window).
 * The key must not contain personal data — hash it first.
 */
export async function allowKey(
  key: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number },
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
