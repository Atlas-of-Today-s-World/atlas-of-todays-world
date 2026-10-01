"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import {
  failed,
  formObject,
  invalid,
  NOT_SIGNED_IN,
  signedIn,
  type ActionState,
} from "@/lib/actions";
import { getFlags } from "@/features/flags/queries";
import { serverEnv } from "@/lib/env.server";
import { SITE_URL } from "@/lib/site";
import { createServiceClient } from "@/lib/supabase/service";
import { InvitationId, InvitationInput } from "./schema";

const PAGE = "/admin/accounts/invitations";

/**
 * Nová pozvánka do týmu (ARCHITEKTURA 7.3). Kdo smí koho pozvat, hlídá DB
 * (RLS + guard_invitations); tady jen validace a hláška. Přiřazení
 * schvalovatele se při přijetí přenese do profilu.
 */
export async function createInvitation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = InvitationInput.safeParse(formObject(formData, ["countries"]));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;

  const { email, roleId, note, approvalGlobal, countries } = parsed.data;
  const { error } = await session.supabase.from("invitations").insert({
    email,
    role_id: roleId,
    note,
    approval_global: approvalGlobal,
    approver_countries: countries,
  });
  if (error) return failed(error);

  revalidatePath(PAGE);
  return { ok: true, message: await sendInvitationEmail(email) };
}

const SHARE_LINK = "Send the invitee a link to the /pozvanka page.";

/**
 * E-mail s pozvánkou (G1) — jen se zapnutým přepínačem `email_auth` (vlastní
 * SMTP, U5). Odkaz vede na /auth/confirm: ověří e-mail a trigger
 * `handle_user_updated` pozvánku přijme. Kdo už účet má (čtenář), e-mail
 * nedostane — pozvánka se uplatní při jeho dalším přihlášení.
 */
async function sendInvitationEmail(email: string): Promise<string> {
  const created = "Invitation created.";
  if (!(await getFlags()).emailAuth || !serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    return `${created} ${SHARE_LINK}`;
  }
  const { error } = await createServiceClient().auth.admin.inviteUserByEmail(email, {
    redirectTo: `${SITE_URL}/auth/confirm?next=/admin`,
    data: { locale: "en" },
  });
  if (!error) return `${created} The invitee received an email with a link.`;
  if (error.code === "email_exists") {
    return `${created} An account with this email already exists — the invitation will apply on its next sign-in.`;
  }
  console.error("[invite-email]", error.code ?? error.message);
  return `${created} The email couldn't be sent. ${SHARE_LINK}`;
}

export async function revokeInvitation(id: string): Promise<ActionState> {
  const parsed = InvitationId.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid invitation." };
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;

  const { error, data } = await session.supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .is("accepted_at", null)
    .select("id");
  if (error) return failed(error);
  if (!data?.length) return { ok: false, error: "This invitation can't be revoked." };

  revalidatePath(PAGE);
  return { ok: true, message: "Invitation revoked." };
}
