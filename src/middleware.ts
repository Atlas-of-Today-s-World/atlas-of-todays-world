import { NextResponse, type NextRequest } from "next/server";

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

const CSP = [
  "default-src 'self'",
  // Next v produkci inlinuje část skriptů; blob: potřebuje MapLibre pro workery.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // Dlaždice mapy, obrázky hesel a náhledy zdrojů.
  "img-src 'self' data: blob: https:",
  // MapLibre si tahá písma pro popisky a dlaždice podkladu; bez nich se
  // popisky kreslí náhradním písmem a v konzoli prší chyby.
  "connect-src 'self' https://server.arcgisonline.com https://*.arcgisonline.com https://fonts.openmaptiles.org https://api.anthropic.com",
  // Vložené infografiky (Flourish, World Bank, YouTube) – nic jiného.
  "frame-src https://flo.uri.sh https://public.flourish.studio https://*.worldbank.org https://www.youtube-nocookie.com https://www.youtube.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

function securityHeaders(response: NextResponse): NextResponse {
  response.headers.set("Content-Security-Policy", CSP);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=()",
  );
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Přihlašovací stránka a routa na ověření hesla musí zůstat dostupné,
  // jinak by se do administrace nedalo dostat.
  const isGate = pathname === "/admin/login" || pathname === "/api/admin/session";
  const isAdmin =
    !isGate &&
    (pathname === "/admin" ||
      pathname.startsWith("/admin/") ||
      pathname.startsWith("/api/admin/"));

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
  if (cookie === token) return securityHeaders(NextResponse.next());

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
