import "server-only";
import { createServerClient, type ServerClient } from "@/lib/supabase/server";

/** Does the user's role require a second factor this session hasn't given yet? (DB function mfa_status, E10) */
async function secondFactorMissing(supabase: ServerClient): Promise<boolean> {
  const { data } = await supabase.rpc("mfa_status");
  const status = data as { required: boolean; aal: string } | null;
  return Boolean(status?.required) && status?.aal !== "aal2";
}

/**
 * Does the user need a second factor, and do they have it in this session? (DB
 * function mfa_status, E10). Without it the DB grants no permissions to a role requiring 2FA.
 */
export async function mfaGate(): Promise<null | { hasFactor: boolean }> {
  const supabase = await createServerClient();
  if (!(await secondFactorMissing(supabase))) return null;
  const { data: factors } = await supabase.auth.mfa.listFactors();
  return { hasFactor: Boolean(factors?.totp.some((factor) => factor.status === "verified")) };
}

/**
 * A team role still waiting for its second factor: no permissions yet, but the
 * admin is where they give it (the admin layout shows the MFA step).
 */
export async function awaitsSecondFactor(): Promise<boolean> {
  return secondFactorMissing(await createServerClient());
}
