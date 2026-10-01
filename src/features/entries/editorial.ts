import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { EntryStatus } from "./schema";

/**
 * Čtení pro redakci — pod session uživatele, takže RLS ukáže jen to, na co
 * role dosáhne (vlastní koncepty, frontu ke schválení…). Bez cache.
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
  /** Jazyk textu; překlad má navíc `translation_of` (G5.3). */
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
    // Celý výpis redakce; hledání a filtry stavu dělá tabulka (DataTable).
    .limit(1000);
  if (mine) query = query.eq("owner_id", userId);
  if (q?.trim()) query = query.ilike("title", `%${q.trim().replace(/[%_]/g, "")}%`);
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
}

export async function getEditableEntry(id: string): Promise<EditableEntry | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("entries")
    .select(
      `${LIST_COLUMNS}, summary, special_slug, cover_url, cover_credit, reading_minutes, body_html, published_on, summary_points, author_id, entry_countries(country_iso3)`,
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

/** Jazykové verze článku pro administraci: originál a všechny jeho překlady. */
export async function listLanguageVersions(entry: { id: string; translation_of: string | null }) {
  const supabase = await createServerClient();
  const original = entry.translation_of ?? entry.id;
  const { data, error } = await supabase
    .from("entries")
    .select("id, locale, title, status, translation_of")
    .or(`id.eq.${original},translation_of.eq.${original}`)
    .order("locale");
  if (error) throw new Error(`[entries] ${error.message}`);
  return data as {
    id: string;
    locale: string;
    title: string;
    status: EntryStatus;
    translation_of: string | null;
  }[];
}

/** Kapitola v editoru (pořadí = pozice). */
export interface EditableChapter {
  title: string;
  summary_points: string[];
  body_html: string;
  illustration_url: string | null;
  illustration_credit: string | null;
  audio_url: string | null;
}

/** Kapitoly a zdroje hesla pro editor (P9). */
export async function getEntryParts(id: string) {
  const supabase = await createServerClient();
  const [chapters, resources] = await Promise.all([
    supabase
      .from("entry_chapters")
      .select("title, summary_points, body_html, illustration_url, illustration_credit, audio_url")
      .eq("entry_id", id)
      .order("position"),
    supabase
      .from("resources")
      .select("kind, title, source, description, url, image_url")
      .eq("entry_id", id)
      .order("position"),
  ]);
  if (chapters.error) throw new Error(`[chapters] ${chapters.error.message}`);
  if (resources.error) throw new Error(`[resources] ${resources.error.message}`);
  return {
    chapters: chapters.data as EditableChapter[],
    // Editor sekcí pracuje s textovými poli — null jako prázdný řetězec.
    resources: resources.data.map((row) =>
      Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value ?? ""])),
    ),
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

/** Fronta ke schválení: čekající články, které smí tento člověk schválit. */
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

/** Zveřejněná podoba (poslední schválená revize) pro porovnání v detailu schvalování. */
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
 * Články ve skupině zemí (globální téma nebo vlastní region) a články, které
 * se do ní dají přidat — pro stránku skupiny v administraci. RLS ukáže jen
 * to, na co role dosáhne.
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
