"use client";

import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/types.gen";
import { requireSupabaseConfig } from "./config";

/** Klient v prohlížeči — jen přihlašovací UI a upload obrázků (ARCHITEKTURA 4.1). */
export function createBrowserClient() {
  const { url, anonKey } = requireSupabaseConfig();
  return createSsrBrowserClient<Database>(url, anonKey);
}
