import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types.gen";
import { requireSupabaseConfig } from "./config";

/**
 * Anonymous cookie-less client for public reads (ARCHITEKTURA 4.2). RLS shows
 * it only published content; results go into `unstable_cache`, so they
 * must not depend on who is viewing.
 */
export function createPublicClient() {
  const { url, anonKey } = requireSupabaseConfig();
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
