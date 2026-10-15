"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  failed,
  formObject,
  jsonField,
  invalid,
  listItemError,
  NOT_SIGNED_IN,
  signedIn,
} from "@/lib/actions";
import type { ActionState } from "@/lib/action-state";
import { adminRoutes } from "@/config/routes";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { previewNote, storePreviewImages } from "@/lib/previews/store";
import { uuid } from "@/lib/validation/common";
import {
  CHAPTER_FIELD_LABEL,
  CHAPTER_HTML_MAX,
  CHAPTER_TOO_LONG,
  ChapterInput,
  EntryFaqItem,
  LearnMoreInput,
  SeoInput,
  TilesInput,
  TILE_FIELD_LABEL,
  TopicLabelsInput,
} from "./schema";
import { MAX_CHAPTERS } from "./constants";
import { refreshEntry } from "./revalidate";

/**
 * The parts of a dossier below the article form: subtopics, FAQ, "Learn more",
 * SEO & GEO and the topic's tiles.
 */

/**
 * Entry chapters (P9) — the form sends each chapter's fields under the same
 * names in page order. All are saved at once in a single transaction
 * (DB `replace_entry_parts`); RLS decides who may, as for the article.
 */
export async function saveChapters(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const entryId = String(formData.get("entry_id") ?? "");
  if (!uuid.safeParse(entryId).success) return { ok: false, error: "Invalid entry." };
  const column = (name: string) => formData.getAll(name).map(String);
  const titles = column("title");
  const ids = column("chapter_id");
  const [points, bodies, illustrations, credits, audio, backgrounds] = [
    column("summary_points"),
    column("body_html"),
    column("illustration_url"),
    column("illustration_credit"),
    column("audio_url"),
    column("tile_background"),
  ];
  const parsed = z
    .array(ChapterInput)
    .max(MAX_CHAPTERS, `At most ${MAX_CHAPTERS} subtopics.`)
    .safeParse(
      titles.map((title, index) => ({
        title,
        summary_points: points[index],
        body_html: bodies[index],
        illustration_url: illustrations[index],
        illustration_credit: credits[index],
        audio_url: audio[index],
        tile_background: backgrounds[index],
        id: ids[index],
      })),
    );
  if (!parsed.success) return listItemError(parsed.error, "Subtopic", CHAPTER_FIELD_LABEL);
  const chapters = parsed.data.map((chapter) => ({
    ...chapter,
    body_html: sanitizeRichHtml(chapter.body_html),
  }));
  // Sanitizing can lengthen the HTML (rel on links): check what will be stored.
  const tooLong = chapters.findIndex((chapter) => chapter.body_html.length > CHAPTER_HTML_MAX);
  if (tooLong >= 0) {
    return {
      ok: false,
      error: `Subtopic ${tooLong + 1}, ${CHAPTER_FIELD_LABEL.body_html}: ${CHAPTER_TOO_LONG}`,
    };
  }

  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { error } = await session.supabase.rpc("replace_entry_parts", {
    p_entry: entryId,
    p_part: "chapters",
    p_items: chapters,
  });
  if (error) return failed(error);
  await refreshEntry(session.supabase, entryId, true);
  return { ok: true, message: "Subtopics saved." };
}

/** Dossier FAQ — shown on the page and as FAQPage structured data. */
export async function saveEntryFaq(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const entryId = String(formData.get("entry_id") ?? "");
  if (!uuid.safeParse(entryId).success) return { ok: false, error: "Invalid entry." };
  const parsed = z.array(EntryFaqItem).max(20).safeParse(jsonField(formData, "items"));
  if (!parsed.success) return listItemError(parsed.error, "Question", {});

  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { error } = await session.supabase.rpc("replace_entry_parts", {
    p_entry: entryId,
    p_part: "faq",
    p_items: parsed.data,
  });
  if (error) return failed(error);
  await refreshEntry(session.supabase, entryId, true);
  return { ok: true, message: "Questions saved." };
}

/**
 * "Learn more" of a dossier: links per tile (JSON field `tiles`) and the rich
 * text of each tile (fields `notes:<tile id>`). Links and notes are each
 * replaced in one transaction; RLS decides who may, as for the article.
 */
export async function saveLearnMore(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const entryId = String(formData.get("entry_id") ?? "");
  if (!uuid.safeParse(entryId).success) return { ok: false, error: "Invalid entry." };
  const parsed = LearnMoreInput.safeParse(jsonField(formData, "tiles"));
  if (!parsed.success) return listItemError(parsed.error, "Tile", {});
  const notes = parsed.data.map((tile) => ({
    tile_id: tile.tile_id,
    body_html: sanitizeRichHtml(String(formData.get(`notes:${tile.tile_id}`) ?? "")),
  }));
  if (notes.some((note) => note.body_html.length > 100_000)) {
    return { ok: false, error: "A tile's text is too long." };
  }

  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const links = parsed.data.flatMap((tile) =>
    tile.links.map((link) => ({ ...link, tile_id: tile.tile_id })),
  );
  const saved = await session.supabase.rpc("replace_entry_parts", {
    p_entry: entryId,
    p_part: "resources",
    p_items: links,
  });
  if (saved.error) return failed(saved.error);
  const noted = await session.supabase.rpc("replace_entry_parts", {
    p_entry: entryId,
    p_part: "tile_notes",
    p_items: notes,
  });
  if (noted.error) return failed(noted.error);
  const previews = await storePreviewImages(
    session.supabase,
    { column: "entry_id", value: entryId },
    links,
  );
  await refreshEntry(session.supabase, entryId, true);
  return { ok: true, message: `Learn more saved.${previewNote(previews)}`, previews };
}

/** SEO & GEO overrides; an empty field means the default derived from the article. */
export async function saveEntrySeo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = SeoInput.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { entry_id, ...fields } = parsed.data;
  const { data, error } = await session.supabase
    .from("entries")
    .update({
      seo_title: fields.seo_title || null,
      seo_description: fields.seo_description || null,
      og_image_url: fields.og_image_url ?? null,
      seo_keywords: fields.seo_keywords,
      geo_summary: fields.geo_summary || null,
      noindex: fields.noindex,
    })
    .eq("id", entry_id)
    .select("id");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "You can't edit this article." };
  await refreshEntry(session.supabase, entry_id, true);
  return { ok: true, message: "SEO & GEO saved." };
}

/**
 * The "Learn more" tiles of a topic and the labels of its two halves, saved at
 * once (DB `replace_tiles`): a tile left out is deleted with its links and text.
 */
export async function saveTopicTiles(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const entryId = String(formData.get("entry_id") ?? "");
  if (!uuid.safeParse(entryId).success) return { ok: false, error: "Invalid entry." };
  const tiles = TilesInput.safeParse(jsonField(formData, "tiles"));
  if (!tiles.success) return listItemError(tiles.error, "Tile", TILE_FIELD_LABEL);
  const labels = TopicLabelsInput.safeParse(formObject(formData));
  if (!labels.success) return invalid(labels.error);

  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { error } = await session.supabase.rpc("replace_tiles", {
    p_entry: entryId,
    p_template: null,
    p_items: tiles.data,
  });
  if (error) return failed(error);
  const { error: labelError } = await session.supabase
    .from("entries")
    .update({
      articles_label: labels.data.articles_label || null,
      learn_more_label: labels.data.learn_more_label || null,
    })
    .eq("id", entryId);
  if (labelError) return failed(labelError);
  await refreshEntry(session.supabase, entryId, true);
  revalidatePath(adminRoutes.content(entryId));
  return { ok: true, message: "Tiles saved." };
}
