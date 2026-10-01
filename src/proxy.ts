import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { buildCsp, securityHeaderEntries } from "@/lib/security/csp";
import { refreshSession } from "@/lib/supabase/middleware";

/**
 * Bezpečnostní hlavičky pro všechny odpovědi a přihlášení (ARCHITEKTURA 7).
 *
 * Session Supabase se obnovuje jen na cestách, kde na přihlášení záleží —
 * veřejné stránky zůstávají statické a bez dotazu na Auth server.
 * Administrace bez přihlášení přesměruje na /login; KDO smí co, rozhoduje až
 * layout administrace (oprávnění z DB) a hlavně RLS.
 */
const dev = process.env.NODE_ENV !== "production";
const CSP = buildCsp({ dev, supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL });
const HEADERS = securityHeaderEntries(CSP, { dev });

function securityHeaders(response: NextResponse): NextResponse {
  for (const [name, value] of HEADERS) response.headers.set(name, value);
  return response;
}

const SESSION_PATHS = ["/admin", "/api/admin", "/ucet", "/login", "/auth", "/pozvanka"];
const PROTECTED_PATHS = ["/admin", "/api/admin", "/ucet"];

const matches = (pathname: string, prefixes: string[]) =>
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const response = NextResponse.next({ request });

  if (!matches(pathname, SESSION_PATHS)) return securityHeaders(response);

  const user = await refreshSession(request, response);
  if (user || !matches(pathname, PROTECTED_PATHS)) return securityHeaders(response);

  if (pathname.startsWith("/api/")) {
    return securityHeaders(NextResponse.json({ error: "Sign in first." }, { status: 401 }));
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return securityHeaders(NextResponse.redirect(login));
}

export const config = {
  // Statické soubory a obrázky hlídat nepotřebujeme.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|data/).*)"],
};
