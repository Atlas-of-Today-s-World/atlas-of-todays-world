import "server-only";
import { createHash } from "node:crypto";
import { serverEnv } from "@/lib/env.server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Rate limit in shared storage (Postgres `rate_limits`, ARCHITEKTURA 8.4) —
 * applies to all instances at once. The address is stored only as a hash.
 *
 * Without a service key (local development) there is no limit; in production the key is set.
 */
export async function allowRequest(
  scope: string,
  headers: Headers,
  limits: { limit: number; windowSeconds: number },
): Promise<boolean> {
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return allowKey(`${scope}:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`, limits);
}

/**
 * The same limit for any key (e.g. one IndexNow ping per URL in a window).
 * The key must not contain personal data — hash it first.
 */
export async function allowKey(
  key: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number },
): Promise<boolean> {
  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) return true;
  const { data, error } = await createServiceClient().rpc("hit_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    // A rate-limit outage must not break the caller (search, pings).
    console.error("[rate-limit]", error.message);
    return true;
  }
  return data === true;
}
