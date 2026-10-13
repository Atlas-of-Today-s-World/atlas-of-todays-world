"use server";

import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { adminRoutes } from "@/config/routes";
import { affected, failed, formAction, idAction } from "@/lib/actions";
import { tags } from "@/lib/cache/tags";
import { uuid } from "@/lib/validation/common";
import { MEMBERSHIP_PLANS } from "./labels";

const GrantInput = z.object({
  user_id: uuid,
  plan: z.enum(MEMBERSHIP_PLANS),
});

/**
 * Free membership (admin only, guard_memberships). Paid memberships are managed
 * exclusively by the Stripe webhook — nobody can change or delete them from the app.
 */
export const grantMembership = formAction(GrantInput, async ({ data, supabase }) => {
  const { error } = await supabase.from("memberships").upsert({
    ...data,
    complimentary: true,
    status: "active",
    started_at: new Date().toISOString(),
  });
  if (error) return failed(error);
  revalidatePath(adminRoutes.members);
  updateTag(tags.patrons);
  return { ok: true, message: "Complimentary membership granted." };
});

export const revokeMembership = idAction(
  async ({ id, supabase }) => {
    const denied = affected(
      await supabase
        .from("memberships")
        .delete()
        .eq("user_id", id)
        .eq("complimentary", true)
        .select("user_id"),
      "Only complimentary memberships can be revoked.",
    );
    if (denied) return denied;
    revalidatePath(adminRoutes.members);
    updateTag(tags.patrons);
    return { ok: true, message: "Membership revoked." };
  },
  { invalid: "Invalid account." },
);
