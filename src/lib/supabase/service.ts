import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types.gen";
import { serverEnv } from "@/lib/env.server";
import { requireSupabaseConfig } from "./config";

/**
 * Servisní klient — OBCHÁZÍ RLS (ARCHITEKTURA 2.4). Jen pro serverové úkony,
 * které nejdou pod právy uživatele: smazání vlastního účtu v Auth, webhooky,
 * rate limit. Nikdy ho nepředávej do klientské komponenty.
 */
export function createServiceClient() {
  const { url } = requireSupabaseConfig();
  const key = serverEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
