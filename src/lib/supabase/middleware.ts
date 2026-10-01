import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

/**
 * Obnoví session v cookies a vrátí ověřeného uživatele (nebo null).
 * Volá se jen na cestách, kde na přihlášení záleží — veřejné stránky
 * zůstávají bez dotazu na Auth server.
 */
export async function refreshSession(
  request: NextRequest,
  response: NextResponse,
): Promise<User | null> {
  const config = supabaseConfig();
  if (!config) return null;

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        for (const { name, value, options } of toSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
