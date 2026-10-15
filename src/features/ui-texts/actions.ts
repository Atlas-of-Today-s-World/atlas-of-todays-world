"use server";

import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { adminRoutes } from "@/config/routes";
import { affected, failed, formAction, NOT_SIGNED_IN, signedIn } from "@/lib/actions";
import type { ActionState } from "@/lib/action-state";
import { tags } from "@/lib/cache/tags";
import type { ServerClient } from "@/lib/supabase/server";
import { editableText } from "./model";
import { UiTextInput, UiTextKey } from "./schema";

/**
 * UI texts (Admin → UI texts). Every write goes through the session client,
 * so RLS decides (section `site`: c for a new change, e to change it again,
 * d to reset it); then the `ui-texts` tag refreshes every page that shows the
 * texts — they regenerate on their next visit.
 */

function refreshed(message: string): ActionState {
  updateTag(tags.uiTexts);
  revalidatePath(adminRoutes.uiTexts, "layout");
  return { ok: true, message };
}

const SAVED =
  "Saved. The site shows the new text within a minute — pages update on their next visit.";
const RESET = "Back to the default text. The site shows it within a minute.";

/** Deletes the change of `key` (RLS: site "d"); null = done. */
async function removeOverride(supabase: ServerClient, key: string): Promise<ActionState | null> {
  return affected(
    await supabase.from("ui_text_overrides").delete().eq("key", key).select("key"),
    "The text can't be reset (no permission).",
  );
}

/**
 * Saves the team's version of a text: a new change (RLS: site "c") or a
 * changed one (site "e"). Saving exactly the default text resets it.
 */
export const saveUiText = formAction(UiTextInput, async ({ data, supabase }) => {
  const current = await supabase
    .from("ui_text_overrides")
    .select("value")
    .eq("key", data.key)
    .maybeSingle();
  if (current.error) return failed(current.error);

  if (data.value === editableText(data.key)?.defaultText) {
    if (!current.data) return { ok: true, message: "This is the default text — nothing to save." };
    const denied = await removeOverride(supabase, data.key);
    return denied ?? refreshed(RESET);
  }

  if (current.data) {
    if (current.data.value === data.value) return { ok: true, message: "No change." };
    const denied = affected(
      await supabase
        .from("ui_text_overrides")
        .update({ value: data.value })
        .eq("key", data.key)
        .select("key"),
      "You can't change this text.",
    );
    if (denied) return denied;
  } else {
    const { error } = await supabase
      .from("ui_text_overrides")
      .insert({ key: data.key, value: data.value });
    if (error) return failed(error);
  }
  return refreshed(SAVED);
});

/** Resets a text to its default — deletes the team's change (RLS: site "d"). */
export async function resetUiText(key: string): Promise<ActionState> {
  if (!UiTextKey.safeParse(key).success) return { ok: false, error: "Unknown text." };
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const denied = await removeOverride(session.supabase, key);
  return denied ?? refreshed(RESET);
}
