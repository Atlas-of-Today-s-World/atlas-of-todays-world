/**
 * Public environment variables (ARCHITEKTURA 3.4). Next inlines them into client
 * code only for the literal `process.env.NEXT_PUBLIC_…` form, so each one is
 * listed separately. An invalid value breaks the build, not the running page.
 * Secret variables live in `env.server.ts`.
 *
 * No Zod: the module is also loaded in the browser (map, sign-in) and full Zod
 * would cost ~90 kB of JS on every page. The checks are simple; a few lines suffice.
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

/** Empty value = not set; a filled-in one must pass the check, otherwise the build fails. */
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
  // Operator contact for the privacy policy and the accessibility statement.
  NEXT_PUBLIC_CONTACT_EMAIL: optional(
    "NEXT_PUBLIC_CONTACT_EMAIL",
    process.env.NEXT_PUBLIC_CONTACT_EMAIL,
    isEmail,
  ),
  // Cloudflare Turnstile for email sign-in (G1); Supabase Auth verifies the secret key (captcha).
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optional(
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    minLength(10),
  ),
} as const;
