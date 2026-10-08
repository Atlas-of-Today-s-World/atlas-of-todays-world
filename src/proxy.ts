import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { buildCsp, newNonce, securityHeaderEntries } from "@/lib/security/csp";
import {
  DEFAULT_LOCALE,
  localePath,
  splitLocale,
  withoutDefaultPrefix,
} from "@/features/i18n/config";
import { refreshSession } from "@/lib/supabase/middleware";
import { ROUTE_PREFIX, isAtOrUnder, routes } from "@/config/routes";

/**
 * Security headers for all responses, plus sign-in handling (ARCHITEKTURA 7).
 *
 * The Supabase session is refreshed only on paths where sign-in matters —
 * public pages stay static and never query the Auth server.
 * The admin without a session redirects to /login; WHO may do what is decided
 * by the admin layout (permissions from the DB) and above all by RLS.
 */
const dev = process.env.NODE_ENV !== "production";
const supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
const CSP = buildCsp({ dev, supabaseUrl });
const HEADERS = securityHeaderEntries(CSP, { dev });

/** `csp`: the per-request nonce policy of a dynamic page instead of the shared one. */
function securityHeaders(response: NextResponse, csp?: string): NextResponse {
  for (const [name, value] of HEADERS) response.headers.set(name, value);
  if (csp) response.headers.set("Content-Security-Policy", csp);
  return response;
}

const SESSION_PATHS = [
  routes.admin,
  "/api/admin",
  routes.account,
  routes.login,
  "/auth",
  routes.invitation,
];
/**
 * Pages rendered for each request that hold a session worth protecting: their
 * scripts run only with this response's nonce (ADR-025). Each must be
 * dynamically rendered — a static page would carry no nonce and not start.
 */
const NONCE_PATHS = [
  routes.admin,
  "/auth",
  routes.login,
  routes.account,
  routes.invitation,
  routes.checkout,
];
const PROTECTED_PATHS = [routes.admin, "/api/admin", routes.account];

const matches = (pathname: string, prefixes: string[]) =>
  prefixes.some((prefix) => isAtOrUnder(pathname, prefix));

/** Paths without language versions: admin, API, callbacks and files (robots.txt…). */
const UNLOCALIZED = ["/admin", "/api", "/auth", "/_next", "/.well-known"];
const isFile = (pathname: string) => /\.[a-z0-9]+$/i.test(pathname);
/** Files that do have language versions (feeds, llms.txt) — routed like pages. */
const LOCALIZED_FILES = new Set(["/feed.xml", "/atom.xml", "/llms.txt", "/llms-full.txt"]);
/** Markdown version of an article: /news/<slug>.md → /[locale]/md/news/<slug>, /topics/<slug>.md → …/md/entry/<slug>. */
const MARKDOWN_KINDS = [
  [ROUTE_PREFIX.news, "news"],
  [ROUTE_PREFIX.topics, "entry"],
] as const;
const MARKDOWN_FILE = /^([a-z0-9-]+)\.md$/;
function markdownArticle(path: string) {
  for (const [prefix, kind] of MARKDOWN_KINDS) {
    if (!path.startsWith(`${prefix}/`)) continue;
    const slug = MARKDOWN_FILE.exec(path.slice(prefix.length + 1))?.[1];
    return slug ? { kind, slug } : undefined;
  }
}
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
  const markdown = markdownArticle(split.path);
  if (markdown && !matches(pathname, UNLOCALIZED)) {
    const target = `/${split.locale}/md/${markdown.kind}/${markdown.slug}`;
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
    // On a clone, like the lowercase redirect: "/en//host" must not become "//host".
    const canonical = request.nextUrl.clone();
    canonical.pathname = (pathname.slice(DEFAULT_LOCALE.length + 1) || "/").replace(/^\/{2,}/, "/");
    canonical.search = search;
    return securityHeaders(NextResponse.redirect(canonical, 308));
  }

  // Next takes the nonce from the forwarded request's CSP header for its own scripts.
  const csp = matches(path, NONCE_PATHS)
    ? buildCsp({ dev, supabaseUrl, nonce: newNonce() })
    : undefined;
  const forwarded = new Headers(request.headers);
  if (csp) forwarded.set("Content-Security-Policy", csp);

  // English without a prefix → route [locale]=en (the browser URL stays the same).
  const response =
    localized && locale === DEFAULT_LOCALE
      ? NextResponse.rewrite(new URL(`/${DEFAULT_LOCALE}${pathname}${search}`, request.url), {
          request: { headers: forwarded },
        })
      : NextResponse.next({ request: { headers: forwarded } });

  if (!matches(path, SESSION_PATHS)) return securityHeaders(response, csp);

  const user = await refreshSession(request, response);
  if (user || !matches(path, PROTECTED_PATHS)) return securityHeaders(response, csp);

  if (path.startsWith("/api/")) {
    return securityHeaders(NextResponse.json({ error: "Sign in first." }, { status: 401 }));
  }
  const login = new URL(localized ? localePath(locale, routes.login) : routes.login, request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return securityHeaders(NextResponse.redirect(login));
}

export const config = {
  // No need to guard static files and images — the proxy runs as a function, so
  // each file it touches costs a call and delays it (the logo is on the LCP path).
  // Their headers come from next.config `headers()`.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|data/|maplibre/|brand/|images/|icon\.svg).*)",
  ],
};
