"use server";

import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import {
  failed,
  formObject,
  invalid,
  NOT_SIGNED_IN,
  signedIn,
  type ActionState,
} from "@/lib/actions";
import { tags } from "@/lib/cache/tags";
import { FlagKey, FlagNoteInput, MaintenanceMessageInput } from "./schema";

const SWITCHES = "/admin/switches";

/** Turns a flag on/off (feature_flags; RLS enforces the permissions "e" right). */
export async function setFlag(key: string, enabled: boolean): Promise<ActionState> {
  if (!FlagKey.safeParse(key).success) return { ok: false, error: "Invalid switch." };
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
  revalidatePath(SWITCHES);
  return { ok: true, message: enabled ? "Turned on." : "Turned off." };
}

/**
 * The note next to a switch (feature_flags.note; same permissions "e" right as
 * the switch). Notes are admin-only, so no public cache changes.
 */
export async function saveFlagNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = FlagNoteInput.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase
    .from("feature_flags")
    .update({ note: parsed.data.note })
    .eq("key", parsed.data.key)
    .select("key");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "You can't change this switch." };
  revalidatePath(SWITCHES);
  return { ok: true, message: "Note saved." };
}

/**
 * Maintenance title and text (site_notices; RLS: section site "e"). Empty
 * fields bring back the built-in wording. Only pages rendered during
 * maintenance read it, so only their tag is refreshed.
 */
export async function saveMaintenanceMessage(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = MaintenanceMessageInput.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase
    .from("site_notices")
    .update(parsed.data)
    .eq("id", 1)
    .select("id");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "You can't change the maintenance message." };
  updateTag(tags.notices);
  revalidatePath(SWITCHES);
  return { ok: true, message: "Maintenance message saved." };
}
