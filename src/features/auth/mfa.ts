import "server-only";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Potřebuje přihlášený druhý faktor, a má ho v této session? (DB funkce
 * mfa_status, E10). Bez něj DB roli s povinným 2FA nedá žádná oprávnění.
 */
export async function mfaGate(): Promise<null | { hasFactor: boolean }> {
  const supabase = await createServerClient();
  const { data } = await supabase.rpc("mfa_status");
  const status = data as { required: boolean; aal: string } | null;
  if (!status?.required || status.aal === "aal2") return null;
  const { data: factors } = await supabase.auth.mfa.listFactors();
  return { hasFactor: Boolean(factors?.totp.some((factor) => factor.status === "verified")) };
}
