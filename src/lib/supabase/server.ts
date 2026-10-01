import "server-only";
import { createServerClient as createSsrClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/db/types.gen";
import { requireSupabaseConfig } from "./config";

/**
 * Klient se session přihlášeného uživatele (ARCHITEKTURA 4.1). Každý dotaz jde
 * pod RLS jako tento uživatel. Pro každý request nový klient.
 * Identitu ověřuj `supabase.auth.getUser()`, nikdy jen `getSession()`.
 */
export async function createServerClient() {
  const { url, anonKey } = requireSupabaseConfig();
  const cookieStore = await cookies();
  return createSsrClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Server Component cookies zapsat nesmí; session obnovuje proxy (src/proxy.ts).
        }
      },
    },
  });
}

/** Přihlášený uživatel ověřený u Auth serveru, nebo null. */
export async function currentUser() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
