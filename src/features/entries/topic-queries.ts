import "server-only";
import { unstable_cache } from "next/cache";
import { PUBLIC_AUTHOR_COLUMNS } from "@/features/authors/queries";
import { DEFAULT_LOCALE, type Locale } from "@/features/i18n/config";
import { entryPageTags, PUBLIC_REVALIDATE_SECONDS } from "@/lib/cache/tags";
import type { ResourceItem } from "@/lib/content-types";
import { must } from "@/lib/db/result";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { createPublicClient } from "@/lib/supabase/public";
import { toTileIcon } from "./constants";
import { BASE_COLUMNS, pickVersion, type Row, TILE_COLUMNS, toSummary } from "./rows";
import type { Encyclopedia, Entry, LearnMoreTile } from "./types";

/**
 * Encyclopedia entries (P9): the public topic page with its chapters, author,
 * "Learn more" tiles, FAQ and SEO. `toEncyclopedia` is shared with the preview
 * by link (`preview-queries.ts`).
 */

export interface AuthorRow {
  slug?: string;
  name: string;
  photo_url: string | null;
  bio: string;
  positionality: string;
}

export interface ChapterRow {
  position: number;
  title: string;
  summary_points: string[];
  body_html: string;
  illustration_url: string | null;
  illustration_credit: string | null;
  audio_url: string | null;
  tile_background?: string | null;
  updated_at?: string;
}

export interface ResourceRow {
  position?: number;
  kind: string | null;
  tile_id?: string | null;
  title: string;
  source: string;
  url: string;
  image_url: string | null;
}

export interface TileRow {
  id: string;
  slug: string;
  label: string;
  description: string;
  icon: string;
  image_url: string | null;
  image_credit: string | null;
  background?: string | null;
  position: number;
}

interface SeoRow {
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  seo_keywords: string[];
  geo_summary: string | null;
  noindex: boolean;
}

export interface NoteRow {
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
  labels?: {
    articles_label: string | null;
    learn_more_label: string | null;
    hero_background?: string | null;
  };
}

const optional = (value: string | null | undefined) => value?.trim() || undefined;

type PlacedResource = ResourceItem & { tileId?: string | null };

/** The topic's own tiles in order; a link goes to its tile, notes are matched by tile. */
function toTiles(parts: EncyclopediaParts, resources: PlacedResource[]): LearnMoreTile[] {
  const notes = new Map((parts.notes ?? []).map((note) => [note.tile_id, note.body_html]));
  return [...(parts.tiles ?? [])].sort(byPosition).map((tile) => ({
    id: tile.id,
    slug: tile.slug,
    label: tile.label,
    description: tile.description,
    icon: toTileIcon(tile.icon),
    image: tile.image_url ?? undefined,
    imageCredit: tile.image_credit ?? undefined,
    background: tile.background ?? undefined,
    resources: resources.filter((resource) => resource.tileId === tile.id).map(withoutTile),
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
export function toEncyclopedia(item: Entry, parts: EncyclopediaParts): Encyclopedia {
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
          slug: author.slug,
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
      tileBackground: chapter.tile_background ?? undefined,
      updated: chapter.updated_at?.slice(0, 10),
      audio: chapter.audio_url ?? undefined,
    })),
    resources: resources.map(withoutTile),
    tiles: toTiles(parts, resources),
    labels: {
      articles: optional(parts.labels?.articles_label),
      learnMore: optional(parts.labels?.learn_more_label),
    },
    heroBackground: optional(parts.labels?.hero_background),
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
const ENCYCLOPEDIA_COLUMNS = `${BASE_COLUMNS}, body_html, summary_points,
  seo_title, seo_description, og_image_url, seo_keywords, geo_summary, noindex,
  articles_label, learn_more_label, hero_background,
  authors(${PUBLIC_AUTHOR_COLUMNS}),
  entry_chapters(position, title, summary_points, body_html, illustration_url, illustration_credit, audio_url, tile_background, updated_at),
  resources(position, kind, tile_id, title, source, url, image_url),
  learn_more_tiles!learn_more_tiles_entry_id_fkey(${TILE_COLUMNS}, position),
  entry_tile_notes(tile_id, body_html),
  entry_faq(position, question, answer)`;

/**
 * A single published entry with everything the page shows — in the page
 * language, otherwise the original; null if it doesn't exist. Cached per slug
 * (`entryPageTags`), like `getEntry`.
 */
export async function getEncyclopediaEntry(
  slug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<Encyclopedia | null> {
  const load = unstable_cache(
    async () => {
      const result = await createPublicClient()
        .from("entries")
        .select(`${ENCYCLOPEDIA_COLUMNS}, translation_of`)
        .eq("status", "published")
        .eq("kind", "entry")
        .eq("slug", slug);
      return must(result, "encyclopedia") as unknown as (Row &
        SeoRow & {
          body_html: string;
          summary_points: string[];
          translation_of: string | null;
          articles_label: string | null;
          learn_more_label: string | null;
          hero_background: string | null;
          authors: AuthorRow | null;
          entry_chapters: ChapterRow[];
          resources: ResourceRow[];
          learn_more_tiles: TileRow[];
          entry_tile_notes: NoteRow[];
          entry_faq: FaqRow[];
        })[];
    },
    ["encyclopedia", slug],
    { tags: entryPageTags(slug), revalidate: PUBLIC_REVALIDATE_SECONDS },
  );
  const rows = await load();
  const version = pickVersion(rows, locale);
  if (!version) return null;
  const { row } = version;
  return toEncyclopedia(
    {
      ...toSummary(row, version.languages),
      html: sanitizeRichHtml(row.body_html),
      locale: version.locale,
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
      labels: row,
    },
  );
}
