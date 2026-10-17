"use server";

import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { adminRoutes } from "@/config/routes";
import { affected, failed, formAction, idAction } from "@/lib/actions";
import type { ActionState } from "@/lib/action-state";
import { tags } from "@/lib/cache/tags";
import { getSubtopicTiles } from "@/features/topics/featured";
import { HomeSettingsInput, PinInput } from "./schema";

/**
 * The home map's subtopics (/admin/home): the pinned list and the tile count.
 * RLS decides: "e" in the `news` or `site` section changes both. Every write
 * refreshes the home map's pins (tags.home).
 */

const NO_RIGHT = "You can't change the home page.";
const NOT_PUBLISHED = "Pick a subtopic of a published entry.";

function changed(): ActionState {
  updateTag(tags.home);
  revalidatePath(adminRoutes.homePage);
  return { ok: true, message: "Saved. The home map shows it within a moment." };
}

/** How many tiles the home map shows (home_settings, one row). */
export const saveHomeSettings = formAction(HomeSettingsInput, async ({ data, supabase }) => {
  const denied = affected(
    await supabase.from("home_settings").update(data).eq("id", 1).select("id"),
    NO_RIGHT,
  );
  return denied ?? changed();
});

/** Pins a published subtopic at the end of the list. */
export const addHomePin = formAction(PinInput, async ({ data: { chapter_id }, supabase }) => {
  // Only a subtopic of a published topic — the ones the home map can show.
  if (!(await getSubtopicTiles()).some((tile) => tile.id === chapter_id)) {
    return { ok: false, error: NOT_PUBLISHED, fieldErrors: { chapter_id: [NOT_PUBLISHED] } };
  }
  const { data: last } = await supabase
    .from("home_featured_items")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("home_featured_items")
    .insert({ chapter_id, position: Math.min((last?.position ?? 0) + 10, 100_000) });
  if (error?.code === "23505") return { ok: false, error: "This subtopic is already pinned." };
  if (error) return failed(error);
  return changed();
});

/** Unpins a subtopic (the subtopic itself stays). */
export const removeHomePin = idAction(
  async ({ id, supabase }) => {
    const denied = affected(
      await supabase.from("home_featured_items").delete().eq("id", id).select("id"),
      NO_RIGHT,
    );
    return denied ?? changed();
  },
  { invalid: "Invalid pin." },
);

/** Moves a pin one place up or down (move_home_featured_item: one transaction, RLS applies). */
export const moveHomePin = idAction(
  async ({ id, supabase }, up: boolean) => {
    if (typeof up !== "boolean") return { ok: false, error: "Invalid pin." };
    const { error } = await supabase.rpc("move_home_featured_item", { p_id: id, p_up: up });
    if (error) return failed(error);
    return changed();
  },
  { invalid: "Invalid pin." },
);
