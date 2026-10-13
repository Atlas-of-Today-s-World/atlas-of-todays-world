import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SITE_PAGES } from "./defaults";
import { SITE_PAGE_SLUGS, type SitePageContent, type SitePageSlug } from "./pages";

/** Reading site pages for editors — under the user's session (RLS: site:v), no cache. */

export interface EditableSitePage extends SitePageContent {
  published: boolean;
  updated_at: string | null;
  /** False = no row yet: the website shows the built-in text and saving creates the row. */
  stored: boolean;
}

export interface PageRevision {
  id: number;
  saved_at: string;
  /** Editor's name (staff_name); null = the migration or a removed account. */
  saved_by: string | null;
  title: string;
  published: boolean;
}

const COLUMNS = "slug, title, description, lead, body_html, last_reviewed, published, updated_at";

type Row = Omit<EditableSitePage, "slug" | "stored"> & { slug: string };

function editable(slug: SitePageSlug, row: Row | undefined): EditableSitePage {
  return row
    ? { ...row, slug, stored: true }
    : { ...DEFAULT_SITE_PAGES[slug], published: false, updated_at: null, stored: false };
}

/** Every site page in the fixed order, a missing row as its built-in text. */
export async function listSitePages(): Promise<EditableSitePage[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("site_pages").select(COLUMNS);
  if (error) throw new Error(`[site-pages] ${error.message}`);
  return SITE_PAGE_SLUGS.map((slug) =>
    editable(
      slug,
      data.find((row) => row.slug === slug),
    ),
  );
}

export async function getEditableSitePage(slug: SitePageSlug): Promise<EditableSitePage> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("site_pages")
    .select(COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`[site-pages] ${error.message}`);
  return editable(slug, data ?? undefined);
}

/** Saved versions of a page, newest first (the newest is the current one). */
export async function listPageRevisions(slug: SitePageSlug): Promise<PageRevision[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("site_page_revisions")
    .select("id, saved_at, saved_by, title, published")
    .eq("page_slug", slug)
    .order("saved_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);
  if (error) throw new Error(`[site-pages] ${error.message}`);
  const people = [...new Set(data.flatMap((row) => (row.saved_by ? [row.saved_by] : [])))];
  const names = new Map(
    await Promise.all(
      people.map(
        async (person) =>
          [person, (await supabase.rpc("staff_name", { p_profile: person })).data] as const,
      ),
    ),
  );
  return data.map((row) => ({
    id: row.id,
    saved_at: row.saved_at,
    saved_by: row.saved_by ? (names.get(row.saved_by) ?? null) : null,
    title: row.title,
    published: row.published,
  }));
}
