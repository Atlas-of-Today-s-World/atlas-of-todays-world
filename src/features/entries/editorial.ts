import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { EntryStatus } from "./schema";
import { ilikeAny } from "@/lib/db/filters";

/**
 * Reads for editors — under the user's session, so RLS shows only what the
 * role can reach (own drafts, approval queue…). No cache.
 */

export interface EditorialRow {
  id: string;
  slug: string;
  kind: "news" | "entry";
  title: string;
  status: EntryStatus;
  category: string;
  region_slug: string | null;
  owner_id: string | null;
  author_name: string | null;
  updated_at: string;
  review_note: string | null;
  publish_at: string | null;
  /** Text language; a translation also has `translation_of` (G5.3). */
  locale: string;
  translation_of: string | null;
}

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
  const { data, error } = await query;
  if (error) throw new Error(`[entries] ${error.message}`);
  return data as EditorialRow[];
}

export interface EditableEntry extends EditorialRow {
  summary: string;
  special_slug: string | null;
  cover_url: string | null;
  cover_credit: string | null;
  reading_minutes: number | null;
  body_html: string;
  published_on: string | null;
  countries: string[];
  summary_points: string[];
  author_id: string | null;
  map_layers: string[];
  hero_background: string | null;
}

export async function getEditableEntry(id: string): Promise<EditableEntry | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("entries")
    .select(
      `${LIST_COLUMNS}, summary, special_slug, cover_url, cover_credit, reading_minutes, body_html, published_on, summary_points, author_id, map_layers, hero_background, entry_countries(country_iso3)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`[entries] ${error.message}`);
  if (!data) return null;
  const { entry_countries, ...rest } = data as typeof data & {
    entry_countries: { country_iso3: string }[];
  };
  return {
    ...(rest as unknown as EditableEntry),
    countries: entry_countries.map((c) => c.country_iso3),
  };
}

/** A chapter in the editor (order = position). */
export interface EditableChapter {
  /** Kept across saves, so the subtopic keeps who created it and when. */
  id?: string;
  title: string;
  summary_points: string[];
  body_html: string;
  illustration_url: string | null;
  illustration_credit: string | null;
  audio_url: string | null;
  tile_background: string | null;
  created_at?: string;
  created_by?: string | null;
  updated_at?: string;
  updated_by?: string | null;
}

/** "Who and when" of a topic and its subtopics, with the editors' names. */
interface EditStamps {
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  names: Record<string, string>;
}

/** A "Learn more" tile of a topic or a template in the admin. */
export interface EditableTile {
  id: string;
  slug: string;
  label: string;
  description: string;
  icon: string;
  image_url: string | null;
  image_credit: string | null;
  background: string | null;
}

const TILE_COLUMNS = "id, slug, label, description, icon, image_url, image_credit, background";

export interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
  articles_label: string;
  learn_more_label: string;
  tiles: EditableTile[];
}

/** Topic templates with their tiles, the default first. */
export async function listTemplates(): Promise<TemplateSummary[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("topic_templates")
    .select(
      `id, name, description, is_default, articles_label, learn_more_label,
       topic_template_tiles(${TILE_COLUMNS}, position)`,
    )
    .order("is_default", { ascending: false })
    .order("name");
  if (error) throw new Error(`[templates] ${error.message}`);
  return data.map(({ topic_template_tiles, ...template }) => ({
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

/** A link of a tile in the editor; text fields, null as an empty string. */
export interface EditableLink {
  title: string;
  source: string;
  description: string;
  url: string;
  image_url: string;
}

export interface EditableSeo {
  seo_title: string;
  seo_description: string;
  og_image_url: string;
  seo_keywords: string[];
  geo_summary: string;
  noindex: boolean;
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
  for (const [name, result] of Object.entries({ chapters, resources, tiles, notes, faq, seo })) {
    if (result.error) throw new Error(`[${name}] ${result.error.message}`);
  }
  const links: Record<string, EditableLink[]> = {};
  for (const row of resources.data ?? []) {
    if (!row.tile_id) continue;
    (links[row.tile_id] ??= []).push({
      title: row.title,
      source: row.source,
      description: row.description,
      url: row.url,
      image_url: row.image_url ?? "",
    });
  }
  const row = seo.data;
  const chapterRows = (chapters.data ?? []) as EditableChapter[];
  // Editors' names for the "created by / edited by" lines (team only, DB staff_name).
  const people = [
    ...new Set(
      [
        row?.owner_id,
        row?.updated_by,
        ...chapterRows.flatMap((c) => [c.created_by, c.updated_by]),
      ].filter((value): value is string => Boolean(value)),
    ),
  ];
  const named = await Promise.all(
    people.map(
      async (person) =>
        [person, (await supabase.rpc("staff_name", { p_profile: person })).data] as const,
    ),
  );
  const names = Object.fromEntries(
    named.filter(([, name]) => name).map(([person, name]) => [person, name as string]),
  );
  return {
    chapters: chapterRows,
    stamps: {
      created_at: row?.created_at ?? "",
      created_by: row?.owner_id ?? null,
      updated_at: row?.updated_at ?? "",
      updated_by: row?.updated_by ?? null,
      names,
    } satisfies EditStamps,
    tiles: (tiles.data ?? []) as EditableTile[],
    labels: {
      template_id: row?.template_id ?? null,
      articles_label: row?.articles_label ?? "",
      learn_more_label: row?.learn_more_label ?? "",
    },
    links,
    notes: Object.fromEntries((notes.data ?? []).map((note) => [note.tile_id, note.body_html])),
    faq: (faq.data ?? []).map((item) => ({ question: item.question, answer: item.answer })),
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

export interface Revision {
  id: number;
  saved_at: string;
  title: string;
}

export async function listRevisions(entryId: string): Promise<Revision[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("entry_revisions")
    .select("id, saved_at, snapshot")
    .eq("entry_id", entryId)
    .order("saved_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(`[revisions] ${error.message}`);
  return data.map((row) => ({
    id: row.id,
    saved_at: row.saved_at,
    title: (row.snapshot as { title?: string }).title ?? "",
  }));
}

/** Approval queue: pending articles this person may approve. */
export async function approvalQueue(): Promise<(EditorialRow & { canApprove: boolean })[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("entries")
    .select(LIST_COLUMNS)
    .eq("status", "pending")
    .order("updated_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(`[approvals] ${error.message}`);
  const rows = data as EditorialRow[];
  const checks = await Promise.all(
    rows.map((row) => supabase.rpc("can_approve_entry", { p_entry: row.id })),
  );
  return rows.map((row, index) => ({ ...row, canApprove: checks[index]?.data === true }));
}

/** Published version (last approved revision) for comparison in the approval detail. */
export async function publishedVersion(entryId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("entry_revisions")
    .select("saved_at, snapshot")
    .eq("entry_id", entryId)
    .order("saved_at", { ascending: false })
    .limit(50);
  const published = (data ?? []).find(
    (row) => (row.snapshot as { status?: string }).status === "published",
  );
  return published
    ? (published.snapshot as { title: string; summary: string; body_html: string })
    : null;
}

/**
 * Articles in a country group (global issue or custom region) and articles that
 * can be added to it — for the group page in the admin. RLS shows only what
 * the role can reach.
 */
export async function listGroupArticles(slug: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("entries")
    .select("id, title, status, special_slug")
    .is("translation_of", null)
    .order("updated_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(`[entries] ${error.message}`);
  const rows = data as {
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
