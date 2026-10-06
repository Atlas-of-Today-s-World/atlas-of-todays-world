"use client";

import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/types.gen";
import { requireSupabaseConfig } from "./config";

/** Browser client — only for the sign-in UI and image uploads (ARCHITEKTURA 4.1). */
export function createBrowserClient() {
  const { url, anonKey } = requireSupabaseConfig();
  // Secure whenever the page itself is on HTTPS (the server sets the same).
  return createSsrBrowserClient<Database>(url, anonKey, {
    cookieOptions: { sameSite: "lax", secure: window.location.protocol === "https:" },
  });
}
