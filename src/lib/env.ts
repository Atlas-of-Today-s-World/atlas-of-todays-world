/**
 * Veřejné proměnné prostředí (ARCHITEKTURA 3.4). Next je do klientského kódu
 * vkládá jen při doslovném zápisu `process.env.NEXT_PUBLIC_…`, proto je každá
 * vyjmenovaná zvlášť. Neplatná hodnota shodí build, ne až běžící stránku.
 * Tajné proměnné jsou v `env.server.ts`.
 *
 * Bez Zodu: modul se načítá i v prohlížeči (mapa, přihlášení) a celý Zod by
 * stál ~90 kB JS na každé stránce. Kontroly jsou jednoduché a stačí na ně pár řádků.
 */

type Check = (value: string) => boolean;

const isUrl: Check = (value) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
const minLength =
  (length: number): Check =>
  (value) =>
    value.length >= length;
const isEmail: Check = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** Prázdná hodnota = nenastaveno; vyplněná musí projít kontrolou, jinak build spadne. */
function optional(name: string, value: string | undefined, check: Check): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (!check(value)) throw new Error(`Neplatná proměnná prostředí ${name}`);
  return value;
}

export const publicEnv = {
  NEXT_PUBLIC_SITE_URL:
    optional("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL, isUrl) ??
    "https://atlas-of-todays-world.vercel.app",
  NEXT_PUBLIC_SUPABASE_URL: optional(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    isUrl,
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optional(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    minLength(20),
  ),
  NEXT_PUBLIC_MAPTILER_KEY: optional(
    "NEXT_PUBLIC_MAPTILER_KEY",
    process.env.NEXT_PUBLIC_MAPTILER_KEY,
    minLength(8),
  ),
  // Kontakt provozovatele pro zásady ochrany soukromí a přístupnost.
  NEXT_PUBLIC_CONTACT_EMAIL: optional(
    "NEXT_PUBLIC_CONTACT_EMAIL",
    process.env.NEXT_PUBLIC_CONTACT_EMAIL,
    isEmail,
  ),
  // Cloudflare Turnstile u přihlášení e-mailem (G1); tajný klíč ověřuje Supabase Auth (captcha).
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optional(
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    minLength(10),
  ),
} as const;
