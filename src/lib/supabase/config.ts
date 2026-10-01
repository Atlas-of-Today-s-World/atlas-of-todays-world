import { publicEnv } from "@/lib/env";

/** Adresa a veřejný klíč Supabase; null, když prostředí Supabase nemá (např. CI bez DB). */
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
