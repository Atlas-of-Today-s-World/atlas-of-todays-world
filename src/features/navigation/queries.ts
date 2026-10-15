import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { getFlags } from "@/features/flags/queries";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { createPublicClient } from "@/lib/supabase/public";
import {
  NAV_COLUMNS,
  NAV_DEFAULT_ROWS,
  navigationFrom,
  type Navigation,
  type NavRow,
} from "./model";

/**
 * Site menus — public read (layer: features/<domain>/queries.ts). Cached under
 * the `site` tag, refreshed when the admin saves. The cached part throws on a
 * database error, so a failure is never cached; `getNavigation` then falls
 * back to the items the code had before the admin (config/navigation.ts), so
 * the site never loses its menu on this table.
 */

const readNavItems = unstable_cache(
  async (): Promise<NavRow[]> => {
    const { data, error } = await createPublicClient()
      .from("nav_items")
      .select(NAV_COLUMNS)
      .eq("visible", true)
      .order("position")
      .order("created_at")
      .order("id");
    if (error) throw new Error(error.message);
    return data;
  },
  ["nav-items"],
  { tags: [tags.site], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

/**
 * The main menu and the legal links as the site shows them: visible items in
 * their order, without those whose feature switch is off (News follows
 * `news_menu`). An empty menu is the team's choice; only a failed read falls
 * back to the built-in items. Read on the server and passed to the (client)
 * header as props.
 */
export const getNavigation = cache(async (): Promise<Navigation> => {
  const [rows, flags] = await Promise.all([
    readNavItems().catch((error: unknown) => {
      console.error("[navigation]", error instanceof Error ? error.message : error);
      return NAV_DEFAULT_ROWS;
    }),
    getFlags(),
  ]);
  return navigationFrom(rows, flags);
});
