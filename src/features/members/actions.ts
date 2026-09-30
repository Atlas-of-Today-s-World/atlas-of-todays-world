"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  failed,
  formObject,
  invalid,
  NOT_SIGNED_IN,
  signedIn,
  type ActionState,
} from "@/lib/actions";
import { uuid } from "@/lib/validation/common";

const GrantInput = z.object({
  user_id: uuid,
  plan: z.enum(["patron", "founding", "institution"]),
});

/**
 * Členství zdarma (jen admin, guard_memberships). Placená členství řídí
 * výhradně Stripe webhook — z aplikace je nikdo nezmění ani nesmaže.
 */
export async function grantMembership(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = GrantInput.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { error } = await session.supabase.from("memberships").upsert({
    ...parsed.data,
    complimentary: true,
    status: "active",
    started_at: new Date().toISOString(),
  });
  if (error) return failed(error);
  revalidatePath("/admin/clenove");
  return { ok: true, message: "Členství zdarma uděleno." };
}

export async function revokeMembership(userId: string): Promise<ActionState> {
  if (!uuid.safeParse(userId).success) return { ok: false, error: "Neplatný účet." };
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase
    .from("memberships")
    .delete()
    .eq("user_id", userId)
    .eq("complimentary", true)
    .select("user_id");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "Zrušit jde jen členství zdarma." };
  revalidatePath("/admin/clenove");
  return { ok: true, message: "Členství zrušeno." };
}
