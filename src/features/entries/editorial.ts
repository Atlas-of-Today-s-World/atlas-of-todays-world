import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { EntryStatus } from "./constants";
import { ilikeAny } from "@/lib/db/filters";
import { must, rowsOf } from "@/lib/db/result";
import { staffNames } from "@/lib/db/staff-names";
import { TILE_COLUMNS } from "./rows";
import type {
  EditableChapter,
  EditableEntry,
  EditableLink,
  EditableSeo,
  EditableTile,
  EditorialRow,
  TemplateSummary,
} from "./types";

/**
 * Reads for editors — under the user's session, so RLS shows only what the
 * role can reach (own drafts, approval queue…). No cache.
 */

const LIST_COLUMNS =
  "id, slug, kind, title, status, category, region_slug, owner_id, author_name, updated_at, review_note, publish_at, locale, translation_of";

export async function listEntries({
  q,
  mine,
  userId,
}: {
  q?: string;
  mine?: boolean;
  userId: string;
}): Promise<EditorialRow[]> {
  const supabase = await createServerClient();
  let query = supabase
    .from("entries")
    .select(LIST_COLUMNS)
    .order("updated_at", { ascending: false })
    // The full editorial listing; search and status filters are done by the table (DataTable).
    .limit(1000);
  if (mine) query = query.eq("owner_id", userId);
  const search = ilikeAny(["title"], q);
  if (search) query = query.or(search);
  return must(await query, "entries") as EditorialRow[];
}

export async function getEditableEntry(id: string): Promise<EditableEntry | null> {
  const supabase = await createServerClient();
  const result = await supabase
    .from("entries")
    .select(
      `${LIST_COLUMNS}, summary, special_slug, cover_url, cover_credit, reading_minutes, body_html, published_on, summary_points, author_id, map_layers, hero_background, entry_countries(country_iso3)`,
    )
    .eq("id", id)
    .maybeSingle();
  const data = must(result, "entries");
  if (!data) return null;
  const { entry_countries, ...rest } = data as typeof data & {
    entry_countries: { country_iso3: string }[];
  };
  return {
    ...(rest as unknown as EditableEntry),
    countries: entry_countries.map((c) => c.country_iso3),
  };
}

/** "Who and when" of a topic and its subtopics, with the editors' names. */
interface EditStamps {
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  names: Record<string, string>;
}

/** Topic templates with their tiles, the default first. */
export async function listTemplates(): Promise<TemplateSummary[]> {
  const supabase = await createServerClient();
  const result = await supabase
    .from("topic_templates")
    .select(
      `id, name, description, is_default, articles_label, learn_more_label,
       topic_template_tiles(${TILE_COLUMNS}, position)`,
    )
    .order("is_default", { ascending: false })
    .order("name");
  return must(result, "templates").map(({ topic_template_tiles, ...template }) => ({
    ...template,
    tiles: [...topic_template_tiles]
      .sort((x, y) => x.position - y.position)
      .map(({ position, ...tile }) => {
        void position;
        return tile;
      }),
  }));
}

export async function getTemplate(id: string): Promise<TemplateSummary | null> {
  return (await listTemplates()).find((template) => template.id === id) ?? null;
}

/** Everything of a dossier below the article form: topics, learn more, FAQ, SEO & GEO. */
export async function getEntryParts(id: string) {
  const supabase = await createServerClient();
  const [chapters, resources, tiles, notes, faq, seo] = await Promise.all([
    supabase
      .from("entry_chapters")
      .select(
        "id, title, summary_points, body_html, illustration_url, illustration_credit, audio_url, tile_background, created_at, created_by, updated_at, updated_by",
      )
      .eq("entry_id", id)
      .order("position"),
    supabase
      .from("resources")
      .select("tile_id, title, source, description, url, image_url")
      .eq("entry_id", id)
      .order("position"),
    supabase.from("learn_more_tiles").select(TILE_COLUMNS).eq("entry_id", id).order("position"),
    supabase.from("entry_tile_notes").select("tile_id, body_html").eq("entry_id", id),
    supabase.from("entry_faq").select("question, answer").eq("entry_id", id).order("position"),
    supabase
      .from("entries")
      .select(
        "seo_title, seo_description, og_image_url, seo_keywords, geo_summary, noindex, template_id, articles_label, learn_more_label, created_at, owner_id, updated_at, updated_by",
      )
      .eq("id", id)
      .single(),
  ]);
  const chapterRows = rowsOf(chapters, "chapters") as EditableChapter[];
  const resourceRows = rowsOf(resources, "resources");
  const tileRows = rowsOf(tiles, "tiles") as EditableTile[];
  const noteRows = rowsOf(notes, "notes");
  const faqRows = rowsOf(faq, "faq");
  const row = must(seo, "seo");
  const links: Record<string, EditableLink[]> = {};
  for (const link of resourceRows) {
    if (!link.tile_id) continue;
    (links[link.tile_id] ??= []).push({
      title: link.title,
      source: link.source,
      description: link.description,
      url: link.url,
      image_url: link.image_url ?? "",
    });
  }
  // Editors' names for the "created by / edited by" lines (team only, DB staff_name).
  const names = await staffNames(supabase, [
    row?.owner_id,
    row?.updated_by,
    ...chapterRows.flatMap((c) => [c.created_by, c.updated_by]),
  ]);
  return {
    chapters: chapterRows,
    stamps: {
      created_at: row?.created_at ?? "",
      created_by: row?.owner_id ?? null,
      updated_at: row?.updated_at ?? "",
      updated_by: row?.updated_by ?? null,
      names,
    } satisfies EditStamps,
    tiles: tileRows,
    labels: {
      template_id: row?.template_id ?? null,
      articles_label: row?.articles_label ?? "",
      learn_more_label: row?.learn_more_label ?? "",
    },
    links,
    notes: Object.fromEntries(noteRows.map((note) => [note.tile_id, note.body_html])),
    faq: faqRows.map((item) => ({ question: item.question, answer: item.answer })),
    seo: {
      seo_title: row?.seo_title ?? "",
      seo_description: row?.seo_description ?? "",
      og_image_url: row?.og_image_url ?? "",
      seo_keywords: row?.seo_keywords ?? [],
      geo_summary: row?.geo_summary ?? "",
      noindex: row?.noindex ?? false,
    } satisfies EditableSeo,
  };
}

/**
 * What the signed-in editor may do with an article (asked in the database):
 * approve it, edit it — a pending or published article only by someone who may
 * also approve it — and withdraw it from review (anyone who edits it). A failed
 * check throws instead of quietly hiding the editor.
 */
export async function entryRights(
  entry: Pick<EditorialRow, "id" | "owner_id" | "status">,
): Promise<{ canApprove: boolean; canEdit: boolean; canWithdraw: boolean }> {
  const supabase = await createServerClient();
  const [approve, edit] = await Promise.all([
    supabase.rpc("can_approve_entry", { p_entry: entry.id }),
    // Seeded articles have no owner — then the role scope decides (news_scope).
    supabase.rpc("can_edit_entry", { p_owner: entry.owner_id as string }),
  ]);
  const canApprove = must(approve, "entries") === true;
  const editsIt = must(edit, "entries") === true;
  // Pending and published articles are changed only by someone who may approve them.
  const canEdit = editsIt && (entry.status === "draft" || entry.status === "planned" || canApprove);
  return { canApprove, canEdit, canWithdraw: editsIt };
}

/** Approval queue: pending articles this person may approve. */
export async function approvalQueue(): Promise<(EditorialRow & { canApprove: boolean })[]> {
  const supabase = await createServerClient();
  const result = await supabase
    .from("entries")
    .select(LIST_COLUMNS)
    .eq("status", "pending")
    .order("updated_at", { ascending: true })
    .limit(200);
  const rows = must(result, "approvals") as EditorialRow[];
  if (!rows.length) return [];
  // One call for the whole queue (it used to be one request per article).
  const checks = await supabase.rpc("can_approve_entries", {
    p_entries: rows.map((row) => row.id),
  });
  const allowed = new Set(
    rowsOf(checks, "approvals")
      .filter((check) => check.can_approve)
      .map((check) => check.entry_id),
  );
  return rows.map((row) => ({ ...row, canApprove: allowed.has(row.id) }));
}

/**
 * Articles in a country group (global issue or custom region) and articles that
 * can be added to it — for the group page in the admin. RLS shows only what
 * the role can reach.
 */
export async function listGroupArticles(slug: string) {
  const supabase = await createServerClient();
  const result = await supabase
    .from("entries")
    .select("id, title, status, special_slug")
    .is("translation_of", null)
    .order("updated_at", { ascending: false })
    .limit(300);
  const rows = must(result, "entries") as {
    id: string;
    title: string;
    status: EntryStatus;
    special_slug: string | null;
  }[];
  return {
    members: rows.filter((row) => row.special_slug === slug),
    candidates: rows.filter((row) => row.special_slug !== slug),
  };
}
