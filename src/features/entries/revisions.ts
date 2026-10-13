import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { must } from "@/lib/db/result";

/**
 * An article's revision history for editors — under the user's session (RLS).
 * No cache.
 */

export interface Revision {
  id: number;
  saved_at: string;
  title: string;
}

export async function listRevisions(entryId: string): Promise<Revision[]> {
  const supabase = await createServerClient();
  const data = must(
    await supabase
      .from("entry_revisions")
      .select("id, saved_at, title:snapshot->>title")
      .eq("entry_id", entryId)
      .order("saved_at", { ascending: false })
      .limit(30),
    "revisions",
  );
  return data.map((row) => ({ id: row.id, saved_at: row.saved_at, title: row.title ?? "" }));
}

/**
 * Published version (newest revision saved while the article was live) for
 * comparison in the approval detail — picked in the database, not by downloading snapshots.
 */
export async function publishedVersion(
  entryId: string,
): Promise<{ title: string; summary: string; body_html: string } | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("entry_revisions")
    .select("title:snapshot->>title, summary:snapshot->>summary, body_html:snapshot->>body_html")
    .eq("entry_id", entryId)
    .eq("snapshot->>status", "published")
    .order("saved_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data
    ? { title: data.title ?? "", summary: data.summary ?? "", body_html: data.body_html ?? "" }
    : null;
}
