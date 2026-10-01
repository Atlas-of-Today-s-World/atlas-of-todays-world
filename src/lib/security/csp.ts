/**
 * Content Security Policy (ARCHITEKTURA 8.2). Nová externí služba = úprava
 * tady + test v csp.test.ts; jinak ji prohlížeč tiše zablokuje.
 *
 * script-src drží 'unsafe-inline': Next vkládá inline bootstrap skripty a nonce
 * by znamenal dynamické renderování každé stránky, což by zrušilo statické/ISR
 * stránky (ADR-012). 'unsafe-eval' je jen ve vývoji (React dev overlay).
 */
export function buildCsp({ dev, supabaseUrl }: { dev: boolean; supabaseUrl?: string }): string {
  const supabase = supabaseUrl ? new URL(supabaseUrl) : null;
  const supabaseHttp = supabase ? supabase.origin : "";
  const supabaseWs = supabase ? `wss://${supabase.host}` : "";

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // blob: potřebuje MapLibre pro web workery.
    "script-src": ["'self'", "'unsafe-inline'", "blob:", ...(dev ? ["'unsafe-eval'"] : [])],
    "worker-src": ["'self'", "blob:"],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
    // Dlaždice mapy, obrázky hesel a náhledy zdrojů jsou z různých https hostů.
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
    // Zvukové verze hesel (P9) leží ve Storage Supabase (bucket entry-audio).
    "media-src": ["'self'", supabaseHttp],
    "frame-src": [
      "https://flo.uri.sh",
      "https://public.flourish.studio",
      "https://*.worldbank.org",
      "https://www.youtube-nocookie.com",
      "https://www.youtube.com",
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

/** Bezpečnostní hlavičky pro každou odpověď (ARCHITEKTURA 8.1, S8). */
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
