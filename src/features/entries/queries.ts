import "server-only";
import { unstable_cache } from "next/cache";
import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "@/features/i18n/config";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import type { FaqItem, NewsCategory, ResourceItem } from "@/lib/content-types";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { createPublicClient } from "@/lib/supabase/public";
import { TILE_ICONS, type TileIcon } from "./constants";

/** Published news item without body — for lists, portraits, sitemap. */
export interface EntrySummary {
  slug: string;
  title: string;
  summary: string;
  category: NewsCategory;
  /** Slug of the region the news item belongs to. */
  region: string | null;
  /** Slug of the global issue, if the news item belongs to one. */
  issue: string | null;
  countries: string[];
  hero?: string;
  heroCredit?: string;
  author?: string;
  published?: string;
  updated?: string;
  readingMinutes?: number;
  /** Languages it is published in (original + translations) — for hreflang. */
  languages: Locale[];
  /** Title and lead come from the translation into the page language (G5.3). */
  translated?: boolean;
}

export interface Entry extends EntrySummary {
  /** Sanitized HTML (sanitized on save and again here on read). */
  html: string;
  /** Language of the displayed text — differs from the page when a translation is missing. */
  locale: Locale;
}

// Anon may read only the listed columns (DB-08) — never select *.
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

/** News item (`/news`) or encyclopedia entry (`/entry`, P9). */
type Kind = "news" | "entry";

const toLocale = (value: string): Locale => (isLocale(value) ? value : DEFAULT_LOCALE);

/** Published translations (title and lead only) — for lists and hreflang. */
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

/** Originals of the given kind (translations appear in lists only as a title, not twice). */
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
 * List of originals in the page language: where a published translation exists,
 * it has the translated title and lead (`translated`); `languages` serves hreflang.
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

/** Published news (originals), newest first; titles in the page language. */
export const getEntries = localized("news");

/** Published encyclopedia entries (originals), newest first. */
export const getEncyclopediaEntries = localized("entry");

/**
 * From the published language versions of the same slug, picks the one in the
 * page language, otherwise the original. Also returns the list of available languages.
 */
function pickVersion<R extends Row & { translation_of: string | null }>(rows: R[], locale: Locale) {
  const original = rows.find((row) => row.translation_of === null);
  const row = rows.find((item) => item.locale === locale) ?? original ?? rows[0];
  if (!row) return null;
  const languages = LOCALES.filter((code) => rows.some((item) => item.locale === code));
  return { row, languages, locale: toLocale(row.locale) };
}

/** A single published news item with text (in the page language, else the original); null if missing. */
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

/** Where an article belongs — shared by news, entries and planned entries. */
interface Placed {
  region: string | null;
  issue: string | null;
  countries: string[];
}

export const entriesOfRegion = <T extends Placed>(entries: T[], region: string) =>
  entries.filter((entry) => entry.region === region);

export const entriesOfCountry = <T extends Placed>(entries: T[], iso3: string) =>
  entries.filter((entry) => entry.countries.includes(iso3));

/** Articles assigned directly to a global issue, followed by those affecting any of its countries. */
export function entriesOfIssue<T extends Placed>(entries: T[], issue: string, countries: string[]) {
  const members = new Set(countries);
  const tagged = entries.filter((entry) => entry.issue === issue);
  const related = entries.filter(
    (entry) => entry.issue !== issue && entry.countries.some((iso3) => members.has(iso3)),
  );
  return [...tagged, ...related];
}

/** Preview by link token (any status): a news item, or an entry including chapters. */
export type Preview = { status: string; expiresAt: string } & (
  { kind: "news"; item: Entry } | { kind: "entry"; item: Encyclopedia }
);

/** null = invalid or expired link. */
export async function getPreview(token: string): Promise<Preview | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  // No cache: the link may be revoked or expired and draft text keeps changing.
  const client = createPublicClient();
  const [base, extra] = await Promise.all([
    client.rpc("entry_preview", { p_token: token }).maybeSingle(),
    client.rpc("entry_preview_parts", { p_token: token }).maybeSingle(),
  ]);
  if (base.error) throw new Error(`[preview] ${base.error.message}`);
  if (extra.error) throw new Error(`[preview] ${extra.error.message}`);
  if (!base.data || !extra.data) return null;
  const { countries, body_html, status, expires_at, ...row } = base.data;
  // The RPC doesn't return the preview language; previews aren't indexed and need no hreflang or note.
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
    item: toEncyclopedia(
      item,
      {
        summary_points: extra.data.summary_points,
        author: extra.data.author as AuthorRow | null,
        chapters: extra.data.chapters as unknown as ChapterRow[],
        resources: extra.data.resources as unknown as ResourceRow[],
      },
      // The preview shows the default tiles; custom tiles, notes and FAQ appear once published.
      await getDefaultTiles(),
    ),
  };
}

// ---------------------------------------------------------------------------
// Encyclopedia entries (P9)
// ---------------------------------------------------------------------------

export interface EntryChapter {
  title: string;
  /** 3–5 bullet points that open the chapter. */
  summaryPoints: string[];
  /** Sanitized HTML of the whole chapter. */
  html: string;
  illustration?: string;
  illustrationCredit?: string;
  /** Audio version of the chapter — the player shows only when it exists. */
  audio?: string;
}

export interface EntryAuthor {
  name: string;
  photo?: string;
  bio: string;
  positionality: string;
}

/** A "Learn more" tile of a dossier with what it holds in this dossier. */
export interface LearnMoreTile {
  id: string;
  slug: string;
  label: string;
  description: string;
  icon: TileIcon;
  image?: string;
  imageCredit?: string;
  resources: ResourceItem[];
  /** Sanitized rich text of the tile in this dossier (e.g. hand-written notes). */
  notesHtml: string;
}

/** SEO & GEO overrides; empty fields fall back to defaults derived from the article. */
interface EntrySeo {
  title?: string;
  description?: string;
  image?: string;
  keywords: string[];
  /** Self-contained answer for generative engines, shown as "In short". */
  geoSummary?: string;
  noindex: boolean;
}

export interface Encyclopedia extends Entry {
  summaryPoints: string[];
  authorProfile?: EntryAuthor;
  chapters: EntryChapter[];
  resources: ResourceItem[];
  /** Default tiles first, then the dossier's own, each with its content. */
  tiles: LearnMoreTile[];
  faq: FaqItem[];
  seo: EntrySeo;
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
  kind: string | null;
  tile_id?: string | null;
  title: string;
  source: string;
  url: string;
  image_url: string | null;
}

interface TileRow {
  id: string;
  slug: string;
  label: string;
  description: string;
  icon: string;
  image_url: string | null;
  image_credit: string | null;
  position: number;
  legacy_kind?: string | null;
}

interface SeoRow {
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  seo_keywords: string[];
  geo_summary: string | null;
  noindex: boolean;
}

interface NoteRow {
  tile_id: string;
  body_html: string;
}

interface FaqRow {
  position: number;
  question: string;
  answer: string;
}

interface EncyclopediaParts {
  summary_points: string[];
  author: AuthorRow | null;
  chapters: ChapterRow[];
  resources: ResourceRow[];
  tiles?: TileRow[];
  notes?: NoteRow[];
  faq?: FaqRow[];
  seo?: SeoRow;
}

const TILE_COLUMNS = "id, slug, label, description, icon, image_url, image_credit, position";

/** Default learn-more tiles (on every dossier), in their order. */
const getDefaultTiles = unstable_cache(
  async (): Promise<TileRow[]> => {
    const { data, error } = await createPublicClient()
      .from("learn_more_tiles")
      .select(`${TILE_COLUMNS}, legacy_kind`)
      .is("entry_id", null)
      .order("position");
    if (error) throw new Error(`[tiles] ${error.message}`);
    return data;
  },
  ["learn-more-tiles"],
  { tags: [tags.entries], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

const toIcon = (value: string): TileIcon =>
  (TILE_ICONS as readonly string[]).includes(value) ? (value as TileIcon) : "link";

const optional = (value: string | null | undefined) => value?.trim() || undefined;

type PlacedResource = ResourceItem & { tileId?: string | null };

/**
 * Tiles of one dossier: defaults, then its own. A link goes to its tile (an
 * older link without one by its legacy kind); notes are matched by tile.
 */
function toTiles(
  defaults: TileRow[],
  parts: EncyclopediaParts,
  resources: PlacedResource[],
): LearnMoreTile[] {
  const byKind = new Map(
    defaults.flatMap((tile) => (tile.legacy_kind ? [[tile.legacy_kind, tile.id] as const] : [])),
  );
  const tileOf = (resource: PlacedResource) =>
    resource.tileId ?? (resource.kind ? byKind.get(resource.kind) : undefined);
  const notes = new Map((parts.notes ?? []).map((note) => [note.tile_id, note.body_html]));
  const own = [...(parts.tiles ?? [])].sort(byPosition);
  return [...defaults, ...own].map((tile) => ({
    id: tile.id,
    slug: tile.slug,
    label: tile.label,
    description: tile.description,
    icon: toIcon(tile.icon),
    image: tile.image_url ?? undefined,
    imageCredit: tile.image_credit ?? undefined,
    resources: resources.filter((resource) => tileOf(resource) === tile.id).map(withoutTile),
    notesHtml: sanitizeRichHtml(notes.get(tile.id) ?? ""),
  }));
}

function withoutTile({ tileId, ...resource }: PlacedResource): ResourceItem {
  void tileId;
  return resource;
}

const byPosition = (a: { position?: number }, b: { position?: number }) =>
  (a.position ?? 0) - (b.position ?? 0);

/** One shape of an entry for both the public page and preview (DB rows → component type). */
function toEncyclopedia(item: Entry, parts: EncyclopediaParts, defaults: TileRow[]): Encyclopedia {
  const author = parts.author;
  const resources: PlacedResource[] = [...parts.resources].sort(byPosition).map((resource) => ({
    title: resource.title,
    source: resource.source,
    url: resource.url,
    image: resource.image_url ?? undefined,
    kind: resource.kind ?? undefined,
    tileId: resource.tile_id,
  }));
  const seo = parts.seo;
  return {
    ...item,
    // The author's name from the profile takes precedence over the article's free text.
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
    resources: resources.map(withoutTile),
    tiles: toTiles(defaults, parts, resources),
    faq: [...(parts.faq ?? [])]
      .sort(byPosition)
      .map(({ question, answer }) => ({ question, answer })),
    seo: {
      title: optional(seo?.seo_title),
      description: optional(seo?.seo_description),
      image: optional(seo?.og_image_url),
      keywords: seo?.seo_keywords ?? [],
      geoSummary: optional(seo?.geo_summary),
      noindex: seo?.noindex ?? false,
    },
  };
}

// Anon may read only the listed columns (DB-08) — nested tables included.
const ENCYCLOPEDIA_COLUMNS = `${COLUMNS}, body_html, summary_points,
  seo_title, seo_description, og_image_url, seo_keywords, geo_summary, noindex,
  authors(name, photo_url, bio, positionality),
  entry_chapters(position, title, summary_points, body_html, illustration_url, illustration_credit, audio_url),
  resources(position, kind, tile_id, title, source, url, image_url),
  learn_more_tiles!learn_more_tiles_entry_id_fkey(${TILE_COLUMNS}),
  entry_tile_notes(tile_id, body_html),
  entry_faq(position, question, answer)`;

/**
 * A single published entry with everything the page shows — in the page
 * language, otherwise the original; null if it doesn't exist.
 */
export async function getEncyclopediaEntry(
  slug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<Encyclopedia | null> {
  const load = unstable_cache(
    async () => {
      const { data, error } = await createPublicClient()
        .from("entries")
        .select(`${ENCYCLOPEDIA_COLUMNS}, translation_of`)
        .eq("status", "published")
        .eq("kind", "entry")
        .eq("slug", slug);
      if (error) throw new Error(`[encyclopedia] ${error.message}`);
      return data as unknown as (Row &
        SeoRow & {
          body_html: string;
          summary_points: string[];
          translation_of: string | null;
          authors: AuthorRow | null;
          entry_chapters: ChapterRow[];
          resources: ResourceRow[];
          learn_more_tiles: TileRow[];
          entry_tile_notes: NoteRow[];
          entry_faq: FaqRow[];
        })[];
    },
    ["encyclopedia", slug],
    { tags: [tags.entries, tags.entry(slug)], revalidate: PUBLIC_REVALIDATE_SECONDS },
  );
  const [rows, defaults] = await Promise.all([load(), getDefaultTiles()]);
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
      tiles: row.learn_more_tiles,
      notes: row.entry_tile_notes,
      faq: row.entry_faq,
      seo: row,
    },
    defaults,
  );
}

/** A planned, not yet written entry — shown greyed out and unlinked on the portrait. */
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

/** Entries for the portrait section: published with a link, planned without (greyed out). */
export function thematicEntries(published: EntrySummary[], upcoming: UpcomingEntry[]) {
  return [
    ...published.map(({ title, category, slug }) => ({ title, category, slug })),
    ...upcoming.map(({ title, category }) => ({ title, category, slug: null })),
  ];
}
