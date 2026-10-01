import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types.gen";
import { serverEnv } from "@/lib/env.server";
import { requireSupabaseConfig } from "./config";

/**
 * Service client — BYPASSES RLS (ARCHITEKTURA 2.4). Only for server operations
 * that can't run under the user's rights: deleting one's own Auth account,
 * webhooks, rate limit. Never pass it to a client component.
 */
export function createServiceClient() {
  const { url } = requireSupabaseConfig();
  const key = serverEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
