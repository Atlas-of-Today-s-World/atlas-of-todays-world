import { EMBED_ORIGINS } from "@/lib/embeds";
import { PRE_PAINT_HASH } from "@/lib/pre-paint";

/**
 * Content Security Policy (ARCHITEKTURA 8.2). A new external service = a change
 * here + a test in csp.test.ts; otherwise the browser silently blocks it.
 *
 * Two script policies (ADR-025, which narrows ADR-012):
 * - Pages rendered per request that hold a session worth protecting (admin,
 *   sign-in, account, invitation, checkout — `NONCE_PATHS` in proxy.ts) get a
 *   fresh `nonce` from the proxy: scripts run only with it ('strict-dynamic'
 *   passes trust on to the scripts they load), plus the one fixed inline
 *   script of the root layout by its hash. Next reads the nonce from the
 *   forwarded request header and puts it on its own scripts.
 * - Static/ISR public pages keep 'unsafe-inline': a nonce there would make every
 *   page dynamic and end the caching.
 * 'unsafe-eval' is only in development (React dev overlay).
 */
/**
 * Cloudflare Turnstile (script and challenge iframe) for sign-in with an email
 * code and the public forms. Its token is checked server-side (no connect-src).
 */
const TURNSTILE = "https://challenges.cloudflare.com";
/** Google's OAuth consent screen, the last hop of the sign-in redirect. */
const GOOGLE_SIGN_IN = "https://accounts.google.com";

export function buildCsp({
  dev,
  supabaseUrl,
  nonce,
}: {
  dev: boolean;
  supabaseUrl?: string;
  nonce?: string;
}): string {
  const supabase = supabaseUrl ? new URL(supabaseUrl) : null;
  const supabaseHttp = supabase ? supabase.origin : "";
  const supabaseWs = supabase ? `wss://${supabase.host}` : "";
  const inline = nonce
    ? [`'nonce-${nonce}'`, "'strict-dynamic'", `'${PRE_PAINT_HASH}'`]
    : ["'unsafe-inline'"];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // blob: is needed by MapLibre for web workers; Turnstile protects email sign-in (G1)
    // and the public forms.
    // With 'strict-dynamic' browsers ignore 'self' and the hosts (kept for older ones).
    "script-src": ["'self'", ...inline, "blob:", TURNSTILE, ...(dev ? ["'unsafe-eval'"] : [])],
    // Inline event handlers (onclick="…") never run: React doesn't use them, so an
    // injected attribute can't execute even though inline <script> stays allowed.
    "script-src-attr": ["'none'"],
    "worker-src": ["'self'", "blob:"],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
    // Map tiles, entry images and source previews come from various https hosts.
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "connect-src": [
      "'self'",
      "https://server.arcgisonline.com",
      "https://*.arcgisonline.com",
      // Label glyphs come from /data/glyphs; a range we don't host from here (map/glyphs.ts).
      "https://fonts.openmaptiles.org",
      "https://api.maptiler.com",
      supabaseHttp,
      supabaseWs,
    ],
    // Audio versions of entries (P9): Supabase Storage, or an https URL pasted in the editor
    // (same as images). Audio can't run a script, so https is enough.
    "media-src": ["'self'", "https:"],
    // Only what the site really frames. YouTube links render as thumbnails
    // (img-src), never as iframes.
    "frame-src": [
      // Charts and maps in the "Maps & charts" carousels: Datawrapper, Flourish,
      // Our World in Data and the World Bank — the one allowlist in lib/embeds.ts,
      // which also decides which URLs are stored and framed.
      ...EMBED_ORIGINS,
      TURNSTILE,
    ],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    // Google sign-in is a form post to our Server Action that redirects via Supabase
    // Auth to Google; a natively submitted form (before hydration) is checked on every hop.
    "form-action": ["'self'", ...(supabaseHttp ? [supabaseHttp] : []), GOOGLE_SIGN_IN],
  };

  const parts = Object.entries(directives).map(
    ([name, values]) => `${name} ${values.filter(Boolean).join(" ")}`,
  );
  if (!dev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/** A fresh nonce for one response: 128 random bits in base64. */
export function newNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

/** Security headers for every response (ARCHITEKTURA 8.1, S8). */
export function securityHeaderEntries(csp: string, { dev }: { dev: boolean }): [string, string][] {
  const headers: [string, string][] = [
    ["Content-Security-Policy", csp],
    ["X-Content-Type-Options", "nosniff"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["X-Frame-Options", "DENY"],
    ["Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()"],
    ["Cross-Origin-Opener-Policy", "same-origin"],
  ];
  if (!dev) headers.push(["Strict-Transport-Security", "max-age=63072000; includeSubDomains"]);
  return headers;
}
