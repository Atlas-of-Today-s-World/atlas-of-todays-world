"use server";

import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { adminRoutes } from "@/config/routes";
import { affected, formAction, NOT_SIGNED_IN, signedIn } from "@/lib/actions";
import type { ActionState } from "@/lib/action-state";
import { tags } from "@/lib/cache/tags";
import { FlagNoteInput, FlagToggleInput, MaintenanceMessageInput } from "./schema";

const SWITCHES = adminRoutes.switches.list;

/** Turns a flag on/off (feature_flags; RLS enforces the permissions "e" right). */
export async function setFlag(flagKey: string, flagEnabled: boolean): Promise<ActionState> {
  const parsed = FlagToggleInput.safeParse({ key: flagKey, enabled: flagEnabled });
  if (!parsed.success) return { ok: false, error: "Invalid switch." };
  const { key, enabled } = parsed.data;
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const denied = affected(
    await session.supabase.from("feature_flags").update({ enabled }).eq("key", key).select("key"),
    "You can't change this switch.",
  );
  if (denied) return denied;
  updateTag(tags.flags);
  revalidatePath(SWITCHES);
  return { ok: true, message: enabled ? "Turned on." : "Turned off." };
}

/**
 * The note next to a switch (feature_flags.note; same permissions "e" right as
 * the switch). Notes are admin-only, so no public cache changes.
 */
export const saveFlagNote = formAction(FlagNoteInput, async ({ data, supabase }) => {
  const denied = affected(
    await supabase
      .from("feature_flags")
      .update({ note: data.note })
      .eq("key", data.key)
      .select("key"),
    "You can't change this switch.",
  );
  if (denied) return denied;
  revalidatePath(SWITCHES);
  return { ok: true, message: "Note saved." };
});

/**
 * Maintenance title and text (site_notices; RLS: section site "e"). Empty
 * fields bring back the built-in wording. Only pages rendered during
 * maintenance read it, so only their tag is refreshed.
 */
export const saveMaintenanceMessage = formAction(
  MaintenanceMessageInput,
  async ({ data, supabase }) => {
    const denied = affected(
      await supabase.from("site_notices").update(data).eq("id", 1).select("id"),
      "You can't change the maintenance message.",
    );
    if (denied) return denied;
    updateTag(tags.notices);
    revalidatePath(SWITCHES);
    return { ok: true, message: "Maintenance message saved." };
  },
);
