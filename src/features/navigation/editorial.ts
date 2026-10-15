import "server-only";
import { must, rowsOf } from "@/lib/db/result";
import type { Tables } from "@/lib/db/types.gen";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Site menus — admin reads (layer: features/<domain>/editorial.ts). Under the
 * session, no cache: the team with `site` "v" also sees hidden items and items
 * whose switch is off.
 */

export type NavItemRecord = Pick<
  Tables<"nav_items">,
  | "id"
  | "menu"
  | "label"
  | "href"
  | "position"
  | "visible"
  | "is_primary"
  | "compact_hidden"
  | "requires_flag"
  | "updated_at"
>;

const COLUMNS =
  "id, menu, label, href, position, visible, is_primary, compact_hidden, requires_flag, updated_at";

/** Every item of both menus, each menu in the order the site shows it. */
export async function listNavItems(): Promise<NavItemRecord[]> {
  const supabase = await createServerClient();
  return rowsOf(
    await supabase
      .from("nav_items")
      .select(COLUMNS)
      .order("menu")
      .order("position")
      .order("created_at")
      .order("id"),
    "navigation",
  );
}

export async function getNavItem(id: string): Promise<NavItemRecord | null> {
  const supabase = await createServerClient();
  return must(
    await supabase.from("nav_items").select(COLUMNS).eq("id", id).maybeSingle(),
    "navigation",
  );
}
