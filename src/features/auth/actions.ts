"use server";

import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { removeUnusedUploads } from "./account-uploads";
import { mfaGate } from "./mfa";

/**
 * Account self-service actions (deleting one's own account). The only place
 * outside the admin that uses the service key: Auth accounts can't be deleted
 * under RLS, so the action first proves who the caller is and that they
 * confirmed, then acts on that one account only.
 */

export interface ActionState {
  ok: boolean;
  /** Error code — the form picks the text in the page language (messages: account.errors). */
  error?: "signIn" | "confirm" | "mfa" | "failed";
}

const DeleteInput = z.object({ confirm: z.string().trim().toLowerCase() });

/**
 * Deleting one's own account (GDPR, ARCHITEKTURA 16.2). The session verifies identity;
 * only the service key can delete the user in Auth. A role that requires two-factor
 * sign-in must have it in this session too (aal2), the same as for the admin.
 *
 * 1. delete_my_personal_data() (session; the DB checks the caller): every invitation
 *    to the caller's verified e-mail (accepted ones too — history only; their audit
 *    rows stay, ids only), their volunteer applications and their exact address on
 *    the allowed e-mails list (unless it is the list's last row) — rows no foreign
 *    key ties to the account. Refused for the last admin, before anything is removed.
 * 2. The Auth account. The profile, membership, page views and approver scope go
 *    by cascade; authors.profile_id and every *_by column are set null (the public
 *    author profile and the articles stay — editorial content).
 * 3. The caller's uploaded files that nothing uses (removeUnusedUploads). Best
 *    effort: a file left behind is only storage, never a broken page.
 */
export async function deleteAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = DeleteInput.safeParse({ confirm: formData.get("confirm") });
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "signIn" };
  if (!parsed.success || parsed.data.confirm !== (user.email ?? "").toLowerCase()) {
    return { ok: false, error: "confirm" };
  }
  if (await mfaGate()) return { ok: false, error: "mfa" };

  const personal = await supabase.rpc("delete_my_personal_data");
  if (personal.error) {
    console.error("[account] personal data not removed", personal.error.message);
    return { ok: false, error: "failed" };
  }

  // TODO(payments): Stripe runs in test mode only. When payments go live, cancel the
  // user's Stripe subscription (memberships.stripe_subscription_id) here, before the
  // account and its membership row are gone — otherwise Stripe keeps charging.
  const service = createServiceClient();
  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[account] delete failed", error.message);
    return { ok: false, error: "failed" };
  }
  try {
    await removeUnusedUploads(service, user.id);
  } catch (cleanup) {
    console.error("[account] uploads not removed", (cleanup as Error).message);
  }
  await supabase.auth.signOut();
  redirect("/");
}
