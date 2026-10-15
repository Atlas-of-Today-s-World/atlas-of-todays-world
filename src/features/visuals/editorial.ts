import "server-only";
import { rowsOf } from "@/lib/db/result";
import { createServerClient } from "@/lib/supabase/server";
import type { VisualOwnerKind } from "./constants";
import { toEditableVisuals, VISUAL_COLUMNS, type VisualRow } from "./rows";
import type { EditableVisual } from "./types";

/**
 * Visuals for the admin editor (under the user's session, no cache), in order
 * and in the shape the editor's form posts them back.
 */

/** The column of a visual that names its owner. */
export const OWNER_COLUMN = {
  region: "region_slug",
  issue: "special_slug",
  entry: "entry_id",
  chapter: "chapter_id",
} as const satisfies Record<VisualOwnerKind, string>;

const EDIT_COLUMNS = `${VISUAL_COLUMNS}, chapter_id, updated_at`;

export async function visualsForEdit(
  kind: VisualOwnerKind,
  key: string,
): Promise<EditableVisual[]> {
  const supabase = await createServerClient();
  const rows = rowsOf(
    await supabase
      .from("visuals")
      .select(EDIT_COLUMNS)
      .eq(OWNER_COLUMN[kind], key)
      .order("position")
      .order("id"),
    "visuals: edit",
  ) as unknown as VisualRow[];
  return toEditableVisuals(rows);
}

export interface ChapterVisuals {
  id: string;
  title: string;
  visuals: EditableVisual[];
}

/** A topic's own visuals and each saved subtopic's, in the subtopics' order. */
export async function topicVisualsForEdit(entryId: string) {
  const supabase = await createServerClient();
  const [topic, chapters] = await Promise.all([
    visualsForEdit("entry", entryId),
    supabase.from("entry_chapters").select("id, title").eq("entry_id", entryId).order("position"),
  ]);
  const list = rowsOf(chapters, "visuals: subtopics");
  const rows = list.length
    ? (rowsOf(
        await supabase
          .from("visuals")
          .select(EDIT_COLUMNS)
          .in(
            "chapter_id",
            list.map((chapter) => chapter.id),
          )
          .order("position")
          .order("id"),
        "visuals: subtopics' visuals",
      ) as unknown as (VisualRow & { chapter_id: string })[])
    : [];
  return {
    topic,
    chapters: list.map((chapter): ChapterVisuals => ({
      id: chapter.id,
      title: chapter.title,
      visuals: toEditableVisuals(rows.filter((row) => row.chapter_id === chapter.id)),
    })),
  };
}
