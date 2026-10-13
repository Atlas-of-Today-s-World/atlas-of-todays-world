"use client";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types.gen";
import { requireSupabaseConfig } from "./config";

/**
 * Browser client WITHOUT a session (ARCHITEKTURA 4.1): the session cookies are
 * httpOnly, so page scripts never hold a user's token. Its only use is sending
 * a file to an upload URL the server signed (`uploadToSignedUrl`); everything
 * that needs the user runs in a Server Action or route handler.
 */
export function createAnonBrowserClient() {
  const { url, anonKey } = requireSupabaseConfig();
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
