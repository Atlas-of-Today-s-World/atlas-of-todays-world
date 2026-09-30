import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { buildCsp, securityHeaderEntries } from "@/lib/security/csp";

/**
 * Zámek administrace a bezpečnostní hlavičky.
 *
 * Administrace zapisuje do obsahu Atlasu, takže nesmí být veřejná. Do doby, než
 * ji převezme přihlášení přes Supabase (viz docs/build-brief.md, P14), ji hlídá
 * sdílené heslo v `ADMIN_TOKEN`:
 *
 *   - nastavené heslo  → administrace i její API chtějí cookie `atlas_admin`
 *   - bez hesla v provozu → administrace je zavřená (404), ať se na Vercelu
 *     nedá omylem vystavit otevřená redakce
 *   - bez hesla lokálně → otevřená, aby prototyp šel zkoušet bez nastavování
 *
 * Hlavičky se nastavují všem odpovědím; CSP je psaná tak, aby prošel Next
 * (inline styly a skripty s nonce nemáme, takže 'unsafe-inline'), ale cizí
 * skripty a rámy ne.
 */
const ADMIN_COOKIE = "atlas_admin";

/** Porovnání bez úniku délky shody přes čas (Edge runtime nemá timingSafeEqual). */
function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

const dev = process.env.NODE_ENV !== "production";
const CSP = buildCsp({ dev, supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL });
const HEADERS = securityHeaderEntries(CSP, { dev });

function securityHeaders(response: NextResponse): NextResponse {
  for (const [name, value] of HEADERS) response.headers.set(name, value);
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Přihlašovací stránka a routa na ověření hesla musí zůstat dostupné,
  // jinak by se do administrace nedalo dostat.
  const isGate = pathname === "/admin/login" || pathname === "/api/admin/session";
  const isAdmin =
    !isGate &&
    (pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/"));

  if (!isAdmin) return securityHeaders(NextResponse.next());

  const token = process.env.ADMIN_TOKEN;

  if (!token) {
    // Bez hesla je administrace jen vývojová hračka; v provozu neexistuje.
    if (process.env.NODE_ENV === "production") {
      return securityHeaders(
        new NextResponse("Not found", { status: 404, headers: { "content-type": "text/plain" } }),
      );
    }
    return securityHeaders(NextResponse.next());
  }

  const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
  if (cookie && constantTimeEqual(cookie, token)) return securityHeaders(NextResponse.next());

  if (pathname.startsWith("/api/admin/")) {
    return securityHeaders(
      NextResponse.json({ error: "Sign in to the administration first." }, { status: 401 }),
    );
  }

  const login = new URL("/admin/login", request.url);
  login.searchParams.set("next", pathname);
  return securityHeaders(NextResponse.redirect(login));
}

export const config = {
  // Statické soubory a obrázky hlídat nepotřebujeme.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|data/).*)"],
};
