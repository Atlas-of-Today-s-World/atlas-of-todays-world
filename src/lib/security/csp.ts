/**
 * Content Security Policy (ARCHITEKTURA 8.2). A new external service = a change
 * here + a test in csp.test.ts; otherwise the browser silently blocks it.
 *
 * script-src keeps 'unsafe-inline': Next injects inline bootstrap scripts and a
 * nonce would mean dynamic rendering of every page, which would kill static/ISR
 * pages (ADR-012). 'unsafe-eval' is only in development (React dev overlay).
 */
/** Cloudflare Turnstile (script and challenge iframe) for sign-in with an email code. */
const TURNSTILE = "https://challenges.cloudflare.com";

export function buildCsp({ dev, supabaseUrl }: { dev: boolean; supabaseUrl?: string }): string {
  const supabase = supabaseUrl ? new URL(supabaseUrl) : null;
  const supabaseHttp = supabase ? supabase.origin : "";
  const supabaseWs = supabase ? `wss://${supabase.host}` : "";

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // blob: is needed by MapLibre for web workers; Turnstile protects email sign-in (G1).
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      "blob:",
      TURNSTILE,
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    "worker-src": ["'self'", "blob:"],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
    // Map tiles, entry images and source previews come from various https hosts.
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "connect-src": [
      "'self'",
      "https://server.arcgisonline.com",
      "https://*.arcgisonline.com",
      "https://fonts.openmaptiles.org",
      "https://api.maptiler.com",
      supabaseHttp,
      supabaseWs,
    ],
    // Audio versions of entries (P9): Supabase Storage, or an https URL pasted in the editor
    // (same as images). Audio can't run a script, so https is enough.
    "media-src": ["'self'", "https:"],
    "frame-src": [
      "https://flo.uri.sh",
      "https://public.flourish.studio",
      "https://*.worldbank.org",
      "https://www.youtube-nocookie.com",
      "https://www.youtube.com",
      TURNSTILE,
    ],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", ...(supabaseHttp ? [supabaseHttp] : [])],
  };

  const parts = Object.entries(directives).map(
    ([name, values]) => `${name} ${values.filter(Boolean).join(" ")}`,
  );
  if (!dev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
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
