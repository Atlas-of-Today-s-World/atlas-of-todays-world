/**
 * Shapes of news and portrait content (news categories, timeline, resources,
 * FAQ, metric cards…) shared by server queries and client components; no
 * runtime dependencies, so client code may import it.
 */

import type { EmbedProvider } from "@/lib/embeds";
import type { Messages } from "@/lib/i18n/messages";

/**
 * The two kinds of article (`entries.kind`): a news item, or a topic (an
 * encyclopedia entry, P9). Labels for the editor in `ARTICLE_KIND_LABEL`.
 */
export const ARTICLE_KINDS = ["news", "entry"] as const;
export type ArticleKind = (typeof ARTICLE_KINDS)[number];

export const ARTICLE_KIND_LABEL: Record<ArticleKind, string> = {
  news: "News article",
  entry: "Entry (encyclopedia article)",
};

/**
 * The four topic groups of a portrait (brief), in display order. Labels:
 * `categoryLabel(group, messages)`.
 */
export const ENTRY_CATEGORIES = [
  "Living Conditions",
  "Society",
  "Politics & International Relations",
  "Historical Roots",
] as const;

type EntryCategory = (typeof ENTRY_CATEGORIES)[number];

/**
 * The one definition of content categories: every entry (news or topic) has one
 * of these — the keys, in display order, are exactly the DB `CHECK` on
 * `entries.category` — and each belongs to one portrait topic group ("Political
 * System" and "International Relations" share one). Labels:
 * `categoryLabel(category, messages)`.
 */
const CATEGORY_GROUP = {
  "Living Conditions": "Living Conditions",
  "Political System": "Politics & International Relations",
  Society: "Society",
  "International Relations": "Politics & International Relations",
  "Historical Roots": "Historical Roots",
} as const satisfies Record<string, EntryCategory>;

export type NewsCategory = keyof typeof CATEGORY_GROUP;

export const NEWS_CATEGORIES = Object.keys(CATEGORY_GROUP) as NewsCategory[];

/** Category labels in the admin (editor select, content tables). */
export const NEWS_CATEGORY_ADMIN_LABEL: Record<NewsCategory, string> = {
  "Living Conditions": "Living Conditions",
  "Political System": "Politics & International Relations",
  Society: "Society",
  "International Relations": "International Relations",
  "Historical Roots": "Historical Roots",
};

/** Admin label of a category; an unknown key shows as itself. */
export function adminCategoryLabel(category: string): string {
  return Object.hasOwn(NEWS_CATEGORY_ADMIN_LABEL, category)
    ? NEWS_CATEGORY_ADMIN_LABEL[category as NewsCategory]
    : category;
}

/**
 * Label of a category or a portrait topic group in the UI texts
 * (`messages.categories`); an unknown key shows as itself.
 */
export function categoryLabel(category: string, t: Pick<Messages, "categories">): string {
  return Object.hasOwn(t.categories, category)
    ? t.categories[category as keyof Messages["categories"]]
    : category;
}

/** The portrait topic group of a category; an unknown one counts as "Society". */
export function entryCategory(category: string): EntryCategory {
  return Object.hasOwn(CATEGORY_GROUP, category)
    ? CATEGORY_GROUP[category as NewsCategory]
    : "Society";
}

/** A source an event rests on (https link with its title). */
export interface TimelineSource {
  title: string;
  url: string;
}

/** One event of a timeline (region, global issue, country or topic). */
export interface TimelineItem {
  title: string;
  date: string;
  /** Plain text: the stored text of events from before rich text, else the rich text's words. */
  text: string;
  /** Rich text (sanitized again on render); empty for events from before it. */
  html?: string;
  sources?: TimelineSource[];
}

/** A whole timeline with its heading (empty title / subtitle = the default heading). */
export interface Timeline {
  title?: string;
  subtitle?: string;
  items: TimelineItem[];
}

export interface ResourceItem {
  title: string;
  source: string;
  url: string;
  image?: string;
  kind?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * Manually entered indicator for a country or region.
 *
 * Automatic indicators from Our World in Data cover nine measures for the whole
 * world (HDI, regime, corruption…). The brief also wants numbers OWID lacks –
 * ethnic groups, displacement, child poverty, freedom score. The editors enter
 * those by hand and per the brief **they are never published without a citation**, so `source` is required.
 *
 * The shape matches the cards on the current site: a big value, a title, a sentence
 * of explanation and below it the source with the year.
 */
export interface MetricCard {
  /** Big number on the card, as text – "10+", "24.4 %", "4/10", "17.8M". */
  value: string;
  /** Indicator name – "Youth Unemployment". */
  label: string;
  /** Sentence explaining what the number means and whom it concerns. */
  description?: string;
  /** Who computed it – "UNHCR", "Freedom House". Without it the card is not published. */
  source: string;
  sourceUrl?: string;
  /** Year or period of the data – "2024", "mid-2025". */
  year?: string;
}

/** Editorial additions to a region portrait (from the database, `portrait()` RPC). */
export interface RegionDossier {
  /** Intro paragraph on the region's socio-political situation (P6, first section). */
  intro?: string;
  /** Manually entered indicators. When present, they take precedence over OWID calculations. */
  metrics?: MetricCard[];
  timelineTitle?: string;
  timelineSubtitle?: string;
  timeline?: TimelineItem[];
  /** Maps & charts (table `visuals`), checked and in order. */
  visuals?: VisualItem[];
  resources?: ResourceItem[];
  faq?: FaqItem[];
}

/**
 * One visual of a "Maps & charts" carousel (region, global issue, topic,
 * subtopic), already checked: an embed's URL is its provider's canonical
 * frame URL, an image's an https URL.
 */
export type VisualItem = {
  id: string;
  title: string;
  caption?: string;
  /** "Source: …" under the visual, linked when there is a URL. */
  source?: { label: string; url?: string };
  /** Frame height hint in px (the editors'); otherwise the provider's own. */
  height?: number;
} & (
  | { kind: "embed"; provider: EmbedProvider; url: string }
  | { kind: "image"; url: string }
  | { kind: "map"; spec: Record<string, unknown> }
  // Custom code (ADR-032): framed sandboxed from /api/visual-html/<id>.
  | { kind: "html" }
);
