import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { SESSION_COOKIE_OPTIONS, supabaseConfig } from "./config";

type CookieToSet = Parameters<SetAllCookies>[0][number];

export interface RefreshedSession {
  /** The user verified with the Auth server, or null. */
  user: User | null;
  /**
   * The request's `Cookie` header after the refresh — what Server Components,
   * Server Actions and route handlers of this request must see (a rotated
   * token, not the one the browser sent). Null when nothing changed.
   */
  cookieHeader: string | null;
  /** Writes the refreshed cookies (and the no-store headers @supabase/ssr asks for) to the response. */
  commit<T extends NextResponse>(response: T): T;
}

/**
 * Refreshes the session in cookies and returns the verified user (or null).
 * Called only on paths where sign-in matters — public pages make no
 * Auth server queries.
 *
 * Runs BEFORE the proxy builds its response: the request headers forwarded to
 * the app are fixed when `NextResponse.next({ request })` is created, so they
 * must be built from `cookieHeader` afterwards, or the page would render with
 * the old, already-rotated token.
 */
export async function refreshSession(request: NextRequest): Promise<RefreshedSession> {
  const written: CookieToSet[] = [];
  const headers: Record<string, string> = {};
  const commit = <T extends NextResponse>(response: T) => {
    for (const { name, value, options } of written) response.cookies.set(name, value, options);
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
    return response;
  };

  const config = supabaseConfig();
  if (!config) return { user: null, cookieHeader: null, commit };

  const supabase = createServerClient(config.url, config.anonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, cacheHeaders) => {
        for (const { name, value, options } of toSet) {
          // A removed cookie arrives as an empty value with maxAge 0.
          if (value) request.cookies.set(name, value);
          else request.cookies.delete(name);
          written.push({ name, value, options });
        }
        Object.assign(headers, cacheHeaders);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user, cookieHeader: written.length ? request.cookies.toString() : null, commit };
}
