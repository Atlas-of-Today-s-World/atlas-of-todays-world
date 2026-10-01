import "server-only";
import { unstable_cache } from "next/cache";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import type { NewsCategory, ResourceItem } from "@/lib/content-types";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { createPublicClient } from "@/lib/supabase/public";

/** Zveřejněná novinka bez těla — pro seznamy, portréty, sitemapu. */
export interface EntrySummary {
  slug: string;
  title: string;
  summary: string;
  category: NewsCategory;
  /** Slug regionu, pod který novinka patří. */
  region: string | null;
  /** Slug global issue, pokud k němu novinka patří. */
  issue: string | null;
  countries: string[];
  hero?: string;
  heroCredit?: string;
  author?: string;
  published?: string;
  updated?: string;
  readingMinutes?: number;
}

export interface Entry extends EntrySummary {
  /** Vyčištěné HTML (sanitizace při uložení i tady při čtení). */
  html: string;
}

// Anon smí jen vyjmenované sloupce (DB-08) — nikdy select *.
const COLUMNS =
  "slug, title, summary, category, region_slug, special_slug, cover_url, cover_credit, author_name, published_on, updated_at, reading_minutes, entry_countries(country_iso3)";

interface Row {
  slug: string;
  title: string;
  summary: string;
  category: string;
  region_slug: string | null;
  special_slug: string | null;
  cover_url: string | null;
  cover_credit: string | null;
  author_name: string | null;
  published_on: string | null;
  updated_at: string;
  reading_minutes: number | null;
  entry_countries: { country_iso3: string }[];
}

function toSummary(row: Row): EntrySummary {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    category: row.category as NewsCategory,
    region: row.region_slug,
    issue: row.special_slug,
    countries: row.entry_countries.map((item) => item.country_iso3),
    hero: row.cover_url ?? undefined,
    heroCredit: row.cover_credit ?? undefined,
    author: row.author_name ?? undefined,
    published: row.published_on ?? undefined,
    updated: row.updated_at.slice(0, 10),
    readingMinutes: row.reading_minutes ?? undefined,
  };
}

/** Novinka (`/news`), nebo encyklopedické heslo (`/entry`, P9). */
type Kind = "news" | "entry";

function listPublished(kind: Kind) {
  return unstable_cache(
    async (): Promise<EntrySummary[]> => {
      const { data, error } = await createPublicClient()
        .from("entries")
        .select(COLUMNS)
        .eq("status", "published")
        .eq("kind", kind)
        .order("published_on", { ascending: false, nullsFirst: false })
        .limit(1000);
      if (error) throw new Error(`[entries] ${error.message}`);
      return (data as Row[]).map(toSummary);
    },
    [kind === "news" ? "entries" : "encyclopedia"],
    { tags: [tags.entries], revalidate: PUBLIC_REVALIDATE_SECONDS },
  );
}

/** Všechny zveřejněné novinky, od nejnovější. */
export const getEntries = listPublished("news");

/** Všechna zveřejněná encyklopedická hesla, od nejnovějšího. */
export const getEncyclopediaEntries = listPublished("entry");

/** Jedna zveřejněná novinka i s textem; null, když neexistuje. */
export function getEntry(slug: string): Promise<Entry | null> {
  return unstable_cache(
    async (): Promise<Entry | null> => {
      const { data, error } = await createPublicClient()
        .from("entries")
        .select(`${COLUMNS}, body_html`)
        .eq("status", "published")
        .eq("kind", "news")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new Error(`[entries] ${error.message}`);
      if (!data) return null;
      const row = data as Row & { body_html: string };
      return { ...toSummary(row), html: sanitizeRichHtml(row.body_html) };
    },
    ["entry", slug],
    { tags: [tags.entries, tags.entry(slug)], revalidate: PUBLIC_REVALIDATE_SECONDS },
  )();
}

/** Kam článek patří — společné pro novinky, hesla i plánovaná hesla. */
interface Placed {
  region: string | null;
  issue: string | null;
  countries: string[];
}

export const entriesOfRegion = <T extends Placed>(entries: T[], region: string) =>
  entries.filter((entry) => entry.region === region);

export const entriesOfCountry = <T extends Placed>(entries: T[], iso3: string) =>
  entries.filter((entry) => entry.countries.includes(iso3));

/** Články přiřazené přímo ke global issue, za nimi ty, které zasáhly některou z jeho zemí. */
export function entriesOfIssue<T extends Placed>(entries: T[], issue: string, countries: string[]) {
  const members = new Set(countries);
  const tagged = entries.filter((entry) => entry.issue === issue);
  const related = entries.filter(
    (entry) => entry.issue !== issue && entry.countries.some((iso3) => members.has(iso3)),
  );
  return [...tagged, ...related];
}

/** Náhled podle tokenu z odkazu (jakýkoli stav): novinka, nebo heslo i s kapitolami. */
export type Preview = { status: string; expiresAt: string } & (
  { kind: "news"; item: Entry } | { kind: "entry"; item: Encyclopedia }
);

/** null = neplatný nebo prošlý odkaz. */
export async function getPreview(token: string): Promise<Preview | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  // Bez cache: odkaz může být zrušený nebo prošlý a text se v konceptu mění.
  const client = createPublicClient();
  const [base, extra] = await Promise.all([
    client.rpc("entry_preview", { p_token: token }).maybeSingle(),
    client.rpc("entry_preview_parts", { p_token: token }).maybeSingle(),
  ]);
  if (base.error) throw new Error(`[preview] ${base.error.message}`);
  if (extra.error) throw new Error(`[preview] ${extra.error.message}`);
  if (!base.data || !extra.data) return null;
  const { countries, body_html, status, expires_at, ...row } = base.data;
  const item: Entry = {
    ...toSummary({ ...row, entry_countries: countries.map((iso3) => ({ country_iso3: iso3 })) }),
    html: sanitizeRichHtml(body_html),
  };
  const meta = { status, expiresAt: expires_at };
  if (extra.data.kind !== "entry") return { ...meta, kind: "news", item };
  return {
    ...meta,
    kind: "entry",
    item: toEncyclopedia(item, {
      summary_points: extra.data.summary_points,
      author: extra.data.author as AuthorRow | null,
      chapters: extra.data.chapters as unknown as ChapterRow[],
      resources: extra.data.resources as unknown as ResourceRow[],
    }),
  };
}

// ---------------------------------------------------------------------------
// Encyklopedická hesla (P9)
// ---------------------------------------------------------------------------

export interface EntryChapter {
  title: string;
  /** 3–5 odrážek, kterými se kapitola otevírá. */
  summaryPoints: string[];
  /** Vyčištěné HTML celé kapitoly. */
  html: string;
  illustration?: string;
  illustrationCredit?: string;
  /** Zvuková verze kapitoly — přehrávač se ukáže, jen když existuje. */
  audio?: string;
}

export interface EntryAuthor {
  name: string;
  photo?: string;
  bio: string;
  positionality: string;
}

export interface Encyclopedia extends Entry {
  summaryPoints: string[];
  authorProfile?: EntryAuthor;
  chapters: EntryChapter[];
  resources: ResourceItem[];
}

interface AuthorRow {
  name: string;
  photo_url: string | null;
  bio: string;
  positionality: string;
}

interface ChapterRow {
  position: number;
  title: string;
  summary_points: string[];
  body_html: string;
  illustration_url: string | null;
  illustration_credit: string | null;
  audio_url: string | null;
}

interface ResourceRow {
  position?: number;
  kind: string;
  title: string;
  source: string;
  url: string;
  image_url: string | null;
}

interface EncyclopediaParts {
  summary_points: string[];
  author: AuthorRow | null;
  chapters: ChapterRow[];
  resources: ResourceRow[];
}

const byPosition = (a: { position?: number }, b: { position?: number }) =>
  (a.position ?? 0) - (b.position ?? 0);

/** Jedna podoba hesla pro veřejnou stránku i náhled (řádky z DB → typ pro komponenty). */
function toEncyclopedia(item: Entry, parts: EncyclopediaParts): Encyclopedia {
  const author = parts.author;
  return {
    ...item,
    // Jméno autora z profilu má přednost před volným textem u článku.
    author: author?.name ?? item.author,
    summaryPoints: parts.summary_points,
    authorProfile: author
      ? {
          name: author.name,
          photo: author.photo_url ?? undefined,
          bio: author.bio,
          positionality: author.positionality,
        }
      : undefined,
    chapters: [...parts.chapters].sort(byPosition).map((chapter) => ({
      title: chapter.title,
      summaryPoints: chapter.summary_points,
      html: sanitizeRichHtml(chapter.body_html),
      illustration: chapter.illustration_url ?? undefined,
      illustrationCredit: chapter.illustration_credit ?? undefined,
      audio: chapter.audio_url ?? undefined,
    })),
    resources: [...parts.resources].sort(byPosition).map((resource) => ({
      title: resource.title,
      source: resource.source,
      url: resource.url,
      image: resource.image_url ?? undefined,
      kind: resource.kind,
    })),
  };
}

// Anon smí jen vyjmenované sloupce (DB-08) — i u vnořených tabulek.
const ENCYCLOPEDIA_COLUMNS = `${COLUMNS}, body_html, summary_points,
  authors(name, photo_url, bio, positionality),
  entry_chapters(position, title, summary_points, body_html, illustration_url, illustration_credit, audio_url),
  resources(position, kind, title, source, url, image_url)`;

/** Jedno zveřejněné heslo se vším, co stránka ukazuje; null, když neexistuje. */
export function getEncyclopediaEntry(slug: string): Promise<Encyclopedia | null> {
  return unstable_cache(
    async (): Promise<Encyclopedia | null> => {
      const { data, error } = await createPublicClient()
        .from("entries")
        .select(ENCYCLOPEDIA_COLUMNS)
        .eq("status", "published")
        .eq("kind", "entry")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new Error(`[encyclopedia] ${error.message}`);
      if (!data) return null;
      const row = data as unknown as Row & {
        body_html: string;
        summary_points: string[];
        authors: AuthorRow | null;
        entry_chapters: ChapterRow[];
        resources: ResourceRow[];
      };
      return toEncyclopedia(
        { ...toSummary(row), html: sanitizeRichHtml(row.body_html) },
        {
          summary_points: row.summary_points,
          author: row.authors,
          chapters: row.entry_chapters,
          resources: row.resources,
        },
      );
    },
    ["encyclopedia", slug],
    { tags: [tags.entries, tags.entry(slug)], revalidate: PUBLIC_REVALIDATE_SECONDS },
  )();
}

/** Plánované, ještě nenapsané heslo — na portrétu šedivě a bez odkazu. */
export interface UpcomingEntry extends Placed {
  title: string;
  category: NewsCategory;
}

export const getPlannedEntries = unstable_cache(
  async (): Promise<UpcomingEntry[]> => {
    const { data, error } = await createPublicClient().rpc("planned_entries");
    if (error) throw new Error(`[encyclopedia] ${error.message}`);
    return data.map((row) => ({
      title: row.title,
      category: row.category as NewsCategory,
      region: row.region_slug,
      issue: row.special_slug,
      countries: row.countries,
    }));
  },
  ["planned-entries"],
  { tags: [tags.entries], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

/** Hesla do sekce portrétu: zveřejněná s odkazem, plánovaná bez něj (šedivě). */
export function thematicEntries(published: EntrySummary[], upcoming: UpcomingEntry[]) {
  return [
    ...published.map(({ title, category, slug }) => ({ title, category, slug })),
    ...upcoming.map(({ title, category }) => ({ title, category, slug: null })),
  ];
}
