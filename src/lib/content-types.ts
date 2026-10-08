/**
 * Shapes of news and portrait content (news categories, timeline, resources,
 * FAQ, metric cards…) shared by server queries and client components; no
 * runtime dependencies, so client code may import it.
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
  /** `provider`: "datawrapper" = an interactive chart (`image` is its URL), otherwise an image. */
  visuals?: { title: string; image: string; caption: string; provider?: string }[];
  resources?: ResourceItem[];
  faq?: FaqItem[];
}
