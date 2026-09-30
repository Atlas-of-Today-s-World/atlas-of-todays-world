"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/db/errors";
import { InvitationId, InvitationInput } from "./schema";

export interface InvitationState {
  ok: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"email" | "roleId" | "note", string[]>>;
}

/**
 * Nová pozvánka do týmu (ARCHITEKTURA 7.3). Kdo smí koho pozvat, hlídá DB
 * (RLS + guard_invitations); tady jen validace a hláška.
 */
export async function createInvitation(
  _prev: InvitationState,
  formData: FormData,
): Promise<InvitationState> {
  const parsed = InvitationInput.safeParse({
    email: formData.get("email"),
    roleId: formData.get("roleId"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Přihlaste se." };

  const { error } = await supabase.from("invitations").insert({
    email: parsed.data.email,
    role_id: parsed.data.roleId,
    note: parsed.data.note,
  });
  if (error) return { ok: false, error: mapDbError(error) };

  revalidatePath("/admin/pozvanky");
  return { ok: true };
}

export async function revokeInvitation(id: string): Promise<InvitationState> {
  const parsed = InvitationId.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Neplatná pozvánka." };

  const supabase = await createServerClient();
  const { error, data } = await supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .is("accepted_at", null)
    .select("id");
  if (error) return { ok: false, error: mapDbError(error) };
  if (!data?.length) return { ok: false, error: "Pozvánku nejde odvolat." };

  revalidatePath("/admin/pozvanky");
  return { ok: true };
}
