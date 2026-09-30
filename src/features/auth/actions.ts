"use server";

import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface ActionState {
  ok: boolean;
  error?: string;
}

const DeleteInput = z.object({ confirm: z.string().trim().toLowerCase() });

/**
 * Smazání vlastního účtu (GDPR, ARCHITEKTURA 16.2). Identitu ověří session,
 * samotné smazání v Auth umí jen servisní klíč. Profil zmizí kaskádou;
 * posledního admina chrání trigger v DB.
 */
export async function deleteAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = DeleteInput.safeParse({ confirm: formData.get("confirm") });
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  if (!parsed.success || parsed.data.confirm !== (user.email ?? "").toLowerCase()) {
    return { ok: false, error: "Type your e-mail address to confirm." };
  }

  const { error } = await createServiceClient().auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[account] delete failed", error.message);
    return {
      ok: false,
      error:
        "The account could not be deleted. If you are the last admin, hand the role over first.",
    };
  }
  await supabase.auth.signOut();
  redirect("/");
}
