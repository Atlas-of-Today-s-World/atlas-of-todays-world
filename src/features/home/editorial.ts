import "server-only";
import { can, type Action, type Permissions } from "@/features/auth/access";
import { must, rowsOf } from "@/lib/db/result";
import { createServerClient } from "@/lib/supabase/server";
import { clampFeaturedCount } from "./config";

/**
 * Home page — admin reads (layer: features/<domain>/editorial.ts, ARCHITEKTURA 4.1),
 * under the editor's session, no cache. The public side reads through
 * features/topics/featured.ts.
 */

/**
 * The home page belongs to two permission sections: `news` (its editors pinned
 * the subtopics so far) and `site` (site content); either one is enough — the
 * same rule as the RLS policies of home_featured_items / home_settings.
 */
export const homeRight = (permissions: Permissions, action: Action) =>
  can(permissions, "news", action) || can(permissions, "site", action);

export interface HomePin {
  id: string;
  chapterId: string;
  /** From the subtopic itself — also for one whose topic is no longer published. */
  title: string | null;
  topicTitle: string | null;
  createdAt: string;
}

interface PinRow {
  id: string;
  chapter_id: string;
  created_at: string;
  entry_chapters: { title: string; entries: { title: string } | null } | null;
}

/** The pinned subtopics in their order. */
export async function listHomePins(): Promise<HomePin[]> {
  const supabase = await createServerClient();
  const rows: PinRow[] = rowsOf(
    await supabase
      .from("home_featured_items")
      .select("id, chapter_id, created_at, entry_chapters(title, entries(title))")
      .order("position")
      .order("id")
      .limit(100),
    "home_featured_items",
  );
  return rows.map((row) => ({
    id: row.id,
    chapterId: row.chapter_id,
    title: row.entry_chapters?.title ?? null,
    topicTitle: row.entry_chapters?.entries?.title ?? null,
    createdAt: row.created_at,
  }));
}

/** How many tiles the home map shows. */
export async function getFeaturedCount(): Promise<number> {
  const supabase = await createServerClient();
  const row = must(
    await supabase.from("home_settings").select("featured_count").eq("id", 1).maybeSingle(),
    "home_settings",
  );
  return clampFeaturedCount(row?.featured_count);
}
