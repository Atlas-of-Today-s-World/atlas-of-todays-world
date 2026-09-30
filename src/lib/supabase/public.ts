import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types.gen";
import { requireSupabaseConfig } from "./config";

/**
 * Anonymní klient bez cookies pro veřejné čtení (ARCHITEKTURA 4.2). RLS mu
 * ukáže jen publikovaný obsah; výsledky jdou do `unstable_cache`, proto
 * nesmí záviset na tom, kdo se dívá.
 */
export function createPublicClient() {
  const { url, anonKey } = requireSupabaseConfig();
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
