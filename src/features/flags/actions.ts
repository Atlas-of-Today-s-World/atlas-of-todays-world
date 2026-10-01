"use server";

import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { failed, NOT_SIGNED_IN, signedIn, type ActionState } from "@/lib/actions";
import { tags } from "@/lib/cache/tags";

const Key = z
  .string()
  .regex(/^[a-z0-9]+(_[a-z0-9]+)*$/)
  .max(40);

/** Zapne/vypne přepínač (feature_flags; právo permissions „e" hlídá RLS). */
export async function setFlag(key: string, enabled: boolean): Promise<ActionState> {
  if (!Key.safeParse(key).success) return { ok: false, error: "Invalid switch." };
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase
    .from("feature_flags")
    .update({ enabled })
    .eq("key", key)
    .select("key");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "You can't change this switch." };
  updateTag(tags.flags);
  revalidatePath("/admin/roles");
  return { ok: true, message: enabled ? "Turned on." : "Turned off." };
}
