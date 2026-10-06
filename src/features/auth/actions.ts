"use server";

import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Account self-service actions (deleting one's own account). The only place
 * outside the admin that uses the service key: Auth accounts can't be deleted
 * under RLS, so the action first proves who the caller is and that they
 * confirmed, then acts on that one account only.
 */

export interface ActionState {
  ok: boolean;
  /** Error code — the form picks the text in the page language (messages: account.errors). */
  error?: "signIn" | "confirm" | "failed";
}

const DeleteInput = z.object({ confirm: z.string().trim().toLowerCase() });

/**
 * Deleting one's own account (GDPR, ARCHITEKTURA 16.2). The session verifies identity;
 * only the service key can delete the user in Auth. The profile goes by cascade;
 * a DB trigger protects the last admin.
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

  const { error } = await createServiceClient().auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[account] delete failed", error.message);
    return { ok: false, error: "failed" };
  }
  await supabase.auth.signOut();
  redirect("/");
}
