import "server-only";
import { createServerClient as createSsrClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/db/types.gen";
import { SESSION_COOKIE_OPTIONS, requireSupabaseConfig } from "./config";

/**
 * Client with the signed-in user's session (ARCHITEKTURA 4.1). Every query runs
 * under RLS as this user. A new client for every request.
 * Verify identity with `supabase.auth.getUser()`, never just `getSession()`.
 */
export async function createServerClient() {
  const { url, anonKey } = requireSupabaseConfig();
  const cookieStore = await cookies();
  return createSsrClient<Database>(url, anonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components may not write cookies; the proxy refreshes the session (src/proxy.ts).
        }
      },
    },
  });
}

/** Signed-in user verified with the Auth server, or null. */
export async function currentUser() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
