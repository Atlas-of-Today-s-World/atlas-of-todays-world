"use server";

import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { adminRoutes } from "@/config/routes";
import { affected, failed, formAction, idAction } from "@/lib/actions";
import type { ActionState } from "@/lib/action-state";
import { tags } from "@/lib/cache/tags";
import { NavItemInput, NavItemUpdate } from "./schema";

/**
 * Site menus (Admin → Site menus). Every write goes through the session
 * client, so RLS decides (section `site`: c adds, e changes and reorders,
 * d deletes); then the `site` tag refreshes every page's header and footer.
 */

function refreshed(message: string): ActionState {
  updateTag(tags.site);
  revalidatePath(adminRoutes.siteNavigation.list, "layout");
  return { ok: true, message };
}

const INVALID = "Invalid menu item.";

/** A new item at the end of its menu (RLS: site "c"). */
export const addNavItem = formAction(NavItemInput, async ({ data, supabase }) => {
  const last = await supabase
    .from("nav_items")
    .select("position")
    .eq("menu", data.menu)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last.error) return failed(last.error);
  const { error } = await supabase
    .from("nav_items")
    .insert({ ...data, position: Math.min((last.data?.position ?? -1) + 1, 1000) });
  if (error) return failed(error);
  return refreshed(`Added: ${data.label}`);
});

/** Changes an item (RLS: site "e"); its menu stays as it is. */
export const updateNavItem = formAction(NavItemUpdate, async ({ data, supabase }) => {
  const { id, menu: _menu, ...fields } = data;
  const denied = affected(
    await supabase.from("nav_items").update(fields).eq("id", id).select("id"),
    "The menu item can't be changed (no permission).",
  );
  if (denied) return denied;
  return refreshed("Saved.");
});

/** Shows or hides an item without deleting it (RLS: site "e"). */
export const setNavItemVisible = idAction(
  async ({ id, supabase }, visible: boolean) => {
    if (typeof visible !== "boolean") return { ok: false, error: INVALID };
    const denied = affected(
      await supabase.from("nav_items").update({ visible }).eq("id", id).select("id"),
      "The menu item can't be changed (no permission).",
    );
    if (denied) return denied;
    return refreshed(visible ? "Shown on the site." : "Hidden from the site.");
  },
  { invalid: INVALID },
);

/** Deletes an item (RLS: site "d"). */
export const deleteNavItem = idAction(
  async ({ id, supabase }) => {
    const denied = affected(
      await supabase.from("nav_items").delete().eq("id", id).select("id"),
      "The menu item can't be deleted (no permission).",
    );
    if (denied) return denied;
    return refreshed("Deleted.");
  },
  { invalid: INVALID },
);

/** Swaps an item with its neighbour in the same menu (RPC move_nav_item; site "e"). */
export const moveNavItem = idAction(
  async ({ id, supabase }, up: boolean) => {
    if (typeof up !== "boolean") return { ok: false, error: INVALID };
    const { error } = await supabase.rpc("move_nav_item", { p_id: id, p_up: up });
    if (error) return failed(error);
    return refreshed("Moved.");
  },
  { invalid: INVALID },
);
