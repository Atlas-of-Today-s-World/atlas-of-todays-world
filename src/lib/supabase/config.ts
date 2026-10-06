import { publicEnv } from "@/lib/env";

/** Supabase URL and public key; null when the environment has no Supabase (e.g. CI without a DB). */
export function supabaseConfig(): { url: string; anonKey: string } | null {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

export function requireSupabaseConfig() {
  const config = supabaseConfig();
  if (!config) {
    throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY).");
  }
  return config;
}

/**
 * Options of the Supabase session cookies. `Secure` wherever the site runs on
 * HTTPS (Vercel: production and previews), so the session never travels over
 * plain HTTP; local development and CI on http://localhost keep working.
 * SameSite=Lax is the @supabase/ssr default, kept explicit.
 */
export const SESSION_COOKIE_OPTIONS = {
  sameSite: "lax",
  secure: process.env.VERCEL === "1",
} as const;
