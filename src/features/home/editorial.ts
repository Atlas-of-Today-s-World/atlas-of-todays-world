import "server-only";
import { can } from "@/features/auth/access";
import type { Action, Permissions } from "@/config/sections";
import { must, rowsOf } from "@/lib/db/result";
import { createServerClient } from "@/lib/supabase/server";
import { clampFeaturedCount, FEATURED_COUNT } from "./config";

/**
 * Home page — admin reads (layer: features/<domain>/editorial.ts, ARCHITEKTURA 4.1),
 * under the editor's session, no cache. The public side reads through
 * features/topics/featured.ts.
 */

/**
 * The home page belongs to two permission sections: `news` (its editors pinned
 * the subtopics before the map listed the newest entries) and `site` (site
 * content); either one is enough — the same rule as the RLS policy of
 * home_settings.
 */
export const homeRight = (permissions: Permissions, action: Action) =>
  can(permissions, "news", action) || can(permissions, "site", action);

/** A published entry as the home map would list it (newest first). */
export interface NewestEntry {
  slug: string;
  title: string;
  publishedOn: string | null;
}

/**
 * The newest published entries, as many as the home map can show at most —
 * the same pick and order as the public read (latestEntries in
 * features/topics/featured.ts), fresh under the editor's session.
 */
export async function listNewestEntries(): Promise<NewestEntry[]> {
  const supabase = await createServerClient();
  const rows = rowsOf(
    await supabase
      .from("entries")
      .select("slug, title, published_on")
      .eq("status", "published")
      .eq("kind", "entry")
      .is("translation_of", null)
      .order("published_on", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(FEATURED_COUNT.max),
    "entries",
  );
  return rows.map((row) => ({ slug: row.slug, title: row.title, publishedOn: row.published_on }));
}

/** How many entry tiles the home map shows. */
export async function getFeaturedCount(): Promise<number> {
  const supabase = await createServerClient();
  const row = must(
    await supabase.from("home_settings").select("featured_count").eq("id", 1).maybeSingle(),
    "home_settings",
  );
  return clampFeaturedCount(row?.featured_count);
}
