/**
 * Typy a číselníky obsahu bez závislosti na `node:fs` – tenhle soubor smí
 * importovat i klientská komponenta. Načítání souborů žije v `content.ts`.
 */

export type NewsCategory =
  | "Living Conditions"
  | "Political System"
  | "Society"
  | "International Relations"
  | "Historical Roots";

export const NEWS_CATEGORIES: NewsCategory[] = [
  "Living Conditions",
  "Political System",
  "Society",
  "International Relations",
  "Historical Roots",
];

export interface TimelineItem {
  title: string;
  date: string;
  text: string;
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

export interface NewsFrontmatter {
  title: string;
  summary: string;
  category: NewsCategory;
  region: string;
  countries?: string[];
  /** Slug global issue ze global-issues.json. Novinka může viset i na něm. */
  issue?: string;
  hero?: string;
  heroCredit?: string;
  author?: string;
  published?: string;
  updated?: string;
  readingMinutes?: number;
}

/** Redakční doplňky portrétu regionu (src/content/regions/<slug>.json). */
export interface RegionDossier {
  timelineTitle?: string;
  timelineSubtitle?: string;
  timeline?: TimelineItem[];
  visuals?: { title: string; image: string; caption: string }[];
  resources?: ResourceItem[];
  faq?: FaqItem[];
}
