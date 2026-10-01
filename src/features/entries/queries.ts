import "server-only";
import { unstable_cache } from "next/cache";
import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "@/features/i18n/config";
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
  /** Jazyky, ve kterých je zveřejněná (originál + překlady) — pro hreflang. */
  languages: Locale[];
  /** Titulek a perex jsou z překladu do jazyka stránky (G5.3). */
  translated?: boolean;
}

export interface Entry extends EntrySummary {
  /** Vyčištěné HTML (sanitizace při uložení i tady při čtení). */
  html: string;
  /** Jazyk zobrazeného textu — liší se od stránky, když překlad chybí. */
  locale: Locale;
}

// Anon smí jen vyjmenované sloupce (DB-08) — nikdy select *.
const COLUMNS =
  "slug, locale, title, summary, category, region_slug, special_slug, cover_url, cover_credit, author_name, published_on, updated_at, reading_minutes, entry_countries(country_iso3)";

interface Row {
  slug: string;
  locale: string;
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

function toSummary(row: Row, languages: Locale[] = [DEFAULT_LOCALE]): EntrySummary {
  return {
    languages,
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

const toLocale = (value: string): Locale => (isLocale(value) ? value : DEFAULT_LOCALE);

/** Zveřejněné překlady (jen titulek a perex) — pro seznamy a hreflang. */
const getPublishedTranslations = unstable_cache(
  async () => {
    const { data, error } = await createPublicClient()
      .from("entries")
      .select("slug, kind, locale, title, summary")
      .eq("status", "published")
      .not("translation_of", "is", null)
      .limit(5000);
    if (error) throw new Error(`[entries] ${error.message}`);
    return data;
  },
  ["entry-translations"],
  { tags: [tags.entries], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

/** Originály daného druhu (překlady jsou v seznamech jen jako titulek, ne dvakrát). */
function listPublished(kind: Kind) {
  return unstable_cache(
    async (): Promise<EntrySummary[]> => {
      const { data, error } = await createPublicClient()
        .from("entries")
        .select(COLUMNS)
        .eq("status", "published")
        .eq("kind", kind)
        .is("translation_of", null)
        .order("published_on", { ascending: false, nullsFirst: false })
        .limit(1000);
      if (error) throw new Error(`[entries] ${error.message}`);
      return (data as Row[]).map((row) => toSummary(row, [toLocale(row.locale)]));
    },
    [kind === "news" ? "entries" : "encyclopedia"],
    { tags: [tags.entries], revalidate: PUBLIC_REVALIDATE_SECONDS },
  );
}

/**
 * Seznam originálů v jazyce stránky: kde existuje zveřejněný překlad, má
 * přeložený titulek a perex (`translated`); `languages` slouží hreflangu.
 */
function localized(kind: Kind) {
  const originals = listPublished(kind);
  return async (locale: Locale = DEFAULT_LOCALE): Promise<EntrySummary[]> => {
    const [list, translations] = await Promise.all([originals(), getPublishedTranslations()]);
    const mine = translations.filter((row) => row.kind === kind);
    return list.map((item) => {
      const versions = mine.filter((row) => row.slug === item.slug);
      const languages = LOCALES.filter(
        (code) => item.languages.includes(code) || versions.some((row) => row.locale === code),
      );
      const own =
        locale === item.languages[0] ? null : versions.find((row) => row.locale === locale);
      return own
        ? { ...item, languages, title: own.title, summary: own.summary, translated: true }
        : { ...item, languages };
    });
  };
}

/** Zveřejněné novinky (originály), od nejnovější; titulky v jazyce stránky. */
export const getEntries = localized("news");

/** Zveřejněná encyklopedická hesla (originály), od nejnovějšího. */
export const getEncyclopediaEntries = localized("entry");

/**
 * Ze zveřejněných jazykových verzí téhož slugu vybere tu v jazyce stránky,
 * jinak originál. Vrací i seznam dostupných jazyků.
 */
function pickVersion<R extends Row & { translation_of: string | null }>(rows: R[], locale: Locale) {
  const original = rows.find((row) => row.translation_of === null);
  const row = rows.find((item) => item.locale === locale) ?? original ?? rows[0];
  if (!row) return null;
  const languages = LOCALES.filter((code) => rows.some((item) => item.locale === code));
  return { row, languages, locale: toLocale(row.locale) };
}

/** Jedna zveřejněná novinka i s textem (v jazyce stránky, jinak originál); null, když neexistuje. */
export async function getEntry(
  slug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<Entry | null> {
  const rows = await unstable_cache(
    async () => {
      const { data, error } = await createPublicClient()
        .from("entries")
        .select(`${COLUMNS}, body_html, translation_of`)
        .eq("status", "published")
        .eq("kind", "news")
        .eq("slug", slug);
      if (error) throw new Error(`[entries] ${error.message}`);
      return data as (Row & { body_html: string; translation_of: string | null })[];
    },
    ["entry", slug],
    { tags: [tags.entries, tags.entry(slug)], revalidate: PUBLIC_REVALIDATE_SECONDS },
  )();
  const version = pickVersion(rows, locale);
  if (!version) return null;
  return {
    ...toSummary(version.row, version.languages),
    html: sanitizeRichHtml(version.row.body_html),
    locale: version.locale,
    translated: version.locale !== DEFAULT_LOCALE,
  };
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
  // Jazyk náhledu RPC nevrací; náhled je mimo index, hreflang ani poznámku nepotřebuje.
  const item: Entry = {
    ...toSummary({
      ...row,
      locale: DEFAULT_LOCALE,
      entry_countries: countries.map((iso3) => ({ country_iso3: iso3 })),
    }),
    html: sanitizeRichHtml(body_html),
    locale: DEFAULT_LOCALE,
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

/**
 * Jedno zveřejněné heslo se vším, co stránka ukazuje — v jazyce stránky,
 * jinak originál; null, když neexistuje.
 */
export async function getEncyclopediaEntry(
  slug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<Encyclopedia | null> {
  const rows = await unstable_cache(
    async () => {
      const { data, error } = await createPublicClient()
        .from("entries")
        .select(`${ENCYCLOPEDIA_COLUMNS}, translation_of`)
        .eq("status", "published")
        .eq("kind", "entry")
        .eq("slug", slug);
      if (error) throw new Error(`[encyclopedia] ${error.message}`);
      return data as unknown as (Row & {
        body_html: string;
        summary_points: string[];
        translation_of: string | null;
        authors: AuthorRow | null;
        entry_chapters: ChapterRow[];
        resources: ResourceRow[];
      })[];
    },
    ["encyclopedia", slug],
    { tags: [tags.entries, tags.entry(slug)], revalidate: PUBLIC_REVALIDATE_SECONDS },
  )();
  const version = pickVersion(rows, locale);
  if (!version) return null;
  const { row } = version;
  return toEncyclopedia(
    {
      ...toSummary(row, version.languages),
      html: sanitizeRichHtml(row.body_html),
      locale: version.locale,
      translated: version.locale !== DEFAULT_LOCALE,
    },
    {
      summary_points: row.summary_points,
      author: row.authors,
      chapters: row.entry_chapters,
      resources: row.resources,
    },
  );
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
