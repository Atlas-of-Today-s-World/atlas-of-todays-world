"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { affected, failed, formAction, idAction, type ActionState } from "@/lib/actions";
import { adminRoutes } from "@/config/routes";
import { getFlags } from "@/features/flags/queries";
import { serverEnv } from "@/lib/env.server";
import { SITE_URL } from "@/lib/site";
import type { ServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { INVITATION_DAYS, InvitationInput } from "./schema";

const PAGE = adminRoutes.invitations;

/**
 * New team invitation (ARCHITEKTURA 7.3). Who may invite whom is enforced by
 * the DB (RLS + guard_invitations); here only validation and a message.
 * Approver assignments (countries, authors) are carried over to the profile
 * on acceptance.
 */
export const createInvitation = formAction(
  InvitationInput,
  async ({ data, supabase }) => {
    const { email, roleId, note, approvalGlobal, countries, authors } = data;
    const { error } = await supabase.from("invitations").insert({
      email,
      role_id: roleId,
      note,
      approval_global: approvalGlobal,
      approver_countries: countries,
      approver_authors: authors,
    });
    if (error) return failed(error);

    revalidatePath(PAGE);
    return { ok: true, message: await sendInvitationEmail(email, "Invitation created.") };
  },
  { arrays: ["countries", "authors"] },
);

const SHARE_LINK = "Send the invitee a link to the /pozvanka page.";

/**
 * Invitation email (G1) — only with the `email_auth` flag enabled (own SMTP,
 * U5). The link goes to /auth/confirm: it verifies the email and the trigger
 * `handle_user_updated` accepts the invitation. Someone who already has an
 * account (a reader) gets no email — the invitation applies on their next
 * sign-in. Sending again to an invitee who hasn't confirmed yet sends a fresh link.
 */
async function sendInvitationEmail(email: string, done: string): Promise<string> {
  if (!(await getFlags()).emailAuth || !serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    return `${done} ${SHARE_LINK}`;
  }
  const { error } = await createServiceClient().auth.admin.inviteUserByEmail(email, {
    redirectTo: `${SITE_URL}/auth/confirm?next=${adminRoutes.overview}`,
    data: { locale: "en" },
  });
  if (!error) return `${done} The invitee received an email with a link.`;
  if (error.code === "email_exists") {
    return `${done} An account with this email already exists — the invitation will apply on its next sign-in.`;
  }
  console.error("[invite-email]", error.code ?? error.message);
  return `${done} The email couldn't be sent. ${SHARE_LINK}`;
}

/**
 * Makes a live invitation valid for another INVITATION_DAYS from now, as the
 * signed-in user (RLS: accounts "e"; guard_invitation_lifetime: never past
 * five days, a privileged role's invitation only by an admin, a revoked one
 * stays revoked). Returns the invitee's e-mail, or the refusal.
 */
async function renew(
  supabase: ServerClient,
  id: string,
): Promise<{ email: string } | { denied: ActionState }> {
  const result = await supabase
    .from("invitations")
    .update({ expires_at: new Date(Date.now() + INVITATION_DAYS * 86_400_000).toISOString() })
    .eq("id", id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("email");
  const denied = affected(result, "This invitation can't be extended (accepted or revoked).");
  if (denied) return { denied };
  return { email: result.data?.[0]?.email ?? "" };
}

/** Extends a live invitation (valid again for INVITATION_DAYS from now). */
export const extendInvitation = idAction(
  async ({ id, supabase }) => {
    const renewed = await renew(supabase, id);
    if ("denied" in renewed) return renewed.denied;
    revalidatePath(PAGE);
    return { ok: true, message: `The invitation is valid for another ${INVITATION_DAYS} days.` };
  },
  { invalid: "Invalid invitation." },
);

/**
 * Sends the invitation e-mail again. The invitation is extended first as the
 * user — that write is the permission check (accounts "e") before the service
 * key sends anything.
 */
export const resendInvitation = idAction(
  async ({ id, supabase }) => {
    const renewed = await renew(supabase, id);
    if ("denied" in renewed) return renewed.denied;
    revalidatePath(PAGE);
    const done = `Invitation renewed for ${INVITATION_DAYS} days.`;
    return { ok: true, message: await sendInvitationEmail(renewed.email, done) };
  },
  { invalid: "Invalid invitation." },
);

/** Revokes an invitation that hasn't been accepted (RLS: accounts "e"). */
export const revokeInvitation = idAction(
  async ({ id, supabase }) => {
    const denied = affected(
      await supabase
        .from("invitations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id)
        .is("accepted_at", null)
        .select("id"),
      "This invitation can't be revoked.",
    );
    if (denied) return denied;
    revalidatePath(PAGE);
    return { ok: true, message: "Invitation revoked." };
  },
  { invalid: "Invalid invitation." },
);
