import type { Locale } from "@/lib/i18n/config";
import type {
  ArticleKind,
  FaqItem,
  NewsCategory,
  ResourceItem,
  Timeline,
} from "@/lib/content-types";
import type { EntryStatus, MapLayer, TileIcon } from "./constants";

/**
 * Article shapes shared by the server reads (`queries.ts`, `topic-queries.ts`,
 * `editorial.ts`, `revisions.ts`) and the components that show or edit them.
 * Types only: a client component may import them without reaching a
 * server-only module.
 */

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
  /** Public profile of the author (/authors/<slug>), when the byline is a profile. */
  authorSlug?: string;
  published?: string;
  updated?: string;
  readingMinutes?: number;
  /** Languages it is published in — for hreflang. */
  languages: Locale[];
}

export interface Entry extends EntrySummary {
  /** Sanitized HTML (sanitized on save and again here on read). */
  html: string;
  /** Language of the displayed text — differs from the page when a translation is missing. */
  locale: Locale;
}

/** An author's published articles (originals) for the profile page, newest first. */
export interface AuthorArticle {
  kind: ArticleKind;
  slug: string;
  title: string;
  category: NewsCategory;
  published?: string;
}

/** Where an article belongs — shared by news, entries and planned entries. */
export interface Placed {
  region: string | null;
  issue: string | null;
  countries: string[];
}

/** A planned, not yet written entry — shown greyed out and unlinked on the portrait. */
export interface UpcomingEntry extends Placed {
  title: string;
  category: NewsCategory;
}

export interface EntryChapter {
  title: string;
  /** 3–5 bullet points that open the chapter. */
  summaryPoints: string[];
  /** Sanitized HTML of the whole chapter. */
  html: string;
  illustration?: string;
  illustrationCredit?: string;
  /** Tile colour when there is no photo. */
  tileBackground?: string;
  /** Day the subtopic last changed (ISO date). */
  updated?: string;
  /** Audio version of the chapter — the player shows only when it exists. */
  audio?: string;
}

export interface EntryAuthor {
  name: string;
  /** Public profile page /authors/<slug> (missing in previews). */
  slug?: string;
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
  /** Tile colour when there is no photo. */
  background?: string;
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
  /** The topic's own resource tiles, each with its content. */
  tiles: LearnMoreTile[];
  /** Headings of the two halves; missing = the default texts. */
  labels: { articles?: string; learnMore?: string };
  /** Header colour when there is no photo. */
  heroBackground?: string;
  faq: FaqItem[];
  seo: EntrySeo;
  /** The topic's timeline (after its intro); null = no events, nothing shown. */
  timeline: Timeline | null;
}

/* Editor shapes (admin, read under the user's session in `editorial.ts`). */

export interface EditorialRow {
  id: string;
  slug: string;
  kind: ArticleKind;
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

export interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
  articles_label: string;
  learn_more_label: string;
  tiles: EditableTile[];
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

export interface Revision {
  id: number;
  saved_at: string;
  title: string;
}

/** A published topic and where it sits on the globe (`getTopicPlaces`; counted by topics/map-counts.ts). */
export interface TopicPlace {
  slug: string;
  title: string;
  region: string | null;
  issue: string | null;
  countries: string[];
  layers: readonly MapLayer[];
}
