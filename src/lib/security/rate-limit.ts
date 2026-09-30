import "server-only";
import { createHash } from "node:crypto";
import { serverEnv } from "@/lib/env.server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Rate limit ve sdíleném úložišti (Postgres `rate_limits`, ARCHITEKTURA 8.4) —
 * platí pro všechny instance najednou. Adresa se ukládá jen jako hash.
 *
 * Bez servisního klíče (lokální vývoj) limit neplatí; v provozu klíč je.
 */
export async function allowRequest(
  scope: string,
  request: Request,
  { limit, windowSeconds }: { limit: number; windowSeconds: number },
): Promise<boolean> {
  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) return true;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `${scope}:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`;
  const { data, error } = await createServiceClient().rpc("hit_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    // Výpadek limitu nesmí shodit hledání.
    console.error("[rate-limit]", error.message);
    return true;
  }
  return data === true;
}
