import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { buildCsp, securityHeaderEntries } from "@/lib/security/csp";
import {
  DEFAULT_LOCALE,
  localePath,
  splitLocale,
  withoutDefaultPrefix,
} from "@/features/i18n/config";
import { refreshSession } from "@/lib/supabase/middleware";

/**
 * Security headers for all responses, plus sign-in handling (ARCHITEKTURA 7).
 *
 * The Supabase session is refreshed only on paths where sign-in matters —
 * public pages stay static and never query the Auth server.
 * The admin without a session redirects to /login; WHO may do what is decided
 * by the admin layout (permissions from the DB) and above all by RLS.
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

/** Paths without language versions: admin, API, callbacks and files (robots.txt…). */
const UNLOCALIZED = ["/admin", "/api", "/auth", "/_next", "/.well-known"];
const isFile = (pathname: string) => /\.[a-z0-9]+$/i.test(pathname);
/** Files that do have language versions (feeds, llms.txt) — routed like pages. */
const LOCALIZED_FILES = new Set(["/feed.xml", "/atom.xml", "/llms.txt", "/llms-full.txt"]);
/** Markdown version of an article: /news/<slug>.md → /[locale]/md/news/<slug>, /topics/<slug>.md → …/md/entry/<slug>. */
const MARKDOWN = /^\/(news|topics)\/([a-z0-9-]+)\.md$/;
const METADATA_IMAGE = /\/(opengraph|twitter)-image[a-z0-9-]*$/;

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Public URLs are lowercase (slugs are checked by the DB); /News → /news, once.
  // The target is built on a clone of the request URL, so the host can't change
  // even for a path like "//Evil.com" (new URL() would read that as a host).
  if (/[A-Z]/.test(pathname) && !matches(pathname, UNLOCALIZED) && !isFile(pathname)) {
    const target = request.nextUrl.clone();
    target.pathname = pathname.toLowerCase().replace(/^\/{2,}/, "/");
    target.search = search;
    return securityHeaders(NextResponse.redirect(target, 308));
  }

  const split = splitLocale(pathname);
  const markdown = MARKDOWN.exec(split.path);
  if (markdown && !matches(pathname, UNLOCALIZED)) {
    const kind = markdown[1] === "topics" ? "entry" : markdown[1];
    const target = `/${split.locale}/md/${kind}/${markdown[2]}`;
    return securityHeaders(NextResponse.rewrite(new URL(target, request.url)));
  }

  // Next links preview images by their internal route (/en/…/opengraph-image-x):
  // served as they are, without the /en → / redirect a social scraper would have to follow.
  const localized =
    !matches(pathname, UNLOCALIZED) &&
    !METADATA_IMAGE.test(pathname) &&
    // `/en/feed.xml` → `/feed.xml` (so it gets the same 308 to the unprefixed URL as pages).
    (!isFile(pathname) || LOCALIZED_FILES.has(withoutDefaultPrefix(split.path)));
  const { locale, path } = localized ? split : { locale: DEFAULT_LOCALE, path: pathname };

  // /en/… is just another spelling of the default version — the canonical URL has no prefix.
  if (
    localized &&
    (pathname === `/${DEFAULT_LOCALE}` || pathname.startsWith(`/${DEFAULT_LOCALE}/`))
  ) {
    const canonical = new URL(
      `${pathname.slice(DEFAULT_LOCALE.length + 1) || "/"}${search}`,
      request.url,
    );
    return securityHeaders(NextResponse.redirect(canonical, 308));
  }

  // English without a prefix → route [locale]=en (the browser URL stays the same).
  const response =
    localized && locale === DEFAULT_LOCALE
      ? NextResponse.rewrite(new URL(`/${DEFAULT_LOCALE}${pathname}${search}`, request.url), {
          request,
        })
      : NextResponse.next({ request });

  if (!matches(path, SESSION_PATHS)) return securityHeaders(response);

  const user = await refreshSession(request, response);
  if (user || !matches(path, PROTECTED_PATHS)) return securityHeaders(response);

  if (path.startsWith("/api/")) {
    return securityHeaders(NextResponse.json({ error: "Sign in first." }, { status: 401 }));
  }
  const login = new URL(localized ? localePath(locale, "/login") : "/login", request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return securityHeaders(NextResponse.redirect(login));
}

export const config = {
  // No need to guard static files and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|data/).*)"],
};
