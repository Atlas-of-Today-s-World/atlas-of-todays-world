"use server";

import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { failed, NOT_SIGNED_IN, signedIn, type ActionState } from "@/lib/actions";
import { tags } from "@/lib/cache/tags";

const Key = z
  .string()
  .regex(/^[a-z0-9]+(_[a-z0-9]+)*$/)
  .max(40);

/** Zapne/vypne přepínač (feature_flags; právo permissions „e" hlídá RLS). */
export async function setFlag(key: string, enabled: boolean): Promise<ActionState> {
  if (!Key.safeParse(key).success) return { ok: false, error: "Neplatný přepínač." };
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase
    .from("feature_flags")
    .update({ enabled })
    .eq("key", key)
    .select("key");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "Přepínač nemůžete měnit." };
  revalidateTag(tags.flags);
  revalidatePath("/admin/role");
  return { ok: true, message: enabled ? "Zapnuto." : "Vypnuto." };
}
