import "server-only";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Does the user need a second factor, and do they have it in this session? (DB
 * function mfa_status, E10). Without it the DB grants no permissions to a role requiring 2FA.
 */
export async function mfaGate(): Promise<null | { hasFactor: boolean }> {
  const supabase = await createServerClient();
  const { data } = await supabase.rpc("mfa_status");
  const status = data as { required: boolean; aal: string } | null;
  if (!status?.required || status.aal === "aal2") return null;
  const { data: factors } = await supabase.auth.mfa.listFactors();
  return { hasFactor: Boolean(factors?.totp.some((factor) => factor.status === "verified")) };
}
