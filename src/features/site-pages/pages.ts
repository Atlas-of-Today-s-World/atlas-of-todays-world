import { routes } from "@/config/routes";

/**
 * Editable site pages (table `site_pages`) — the fixed list matching the CHECK
 * `site_pages_slug_check`. Each slug is a page the app renders at its own
 * route; adding one = migration (CHECK + seed row) + an entry here + the page.
 * No server dependency: the admin form imports it too.
 */
export const SITE_PAGE_SLUGS = ["about", "privacy", "terms", "accessibility"] as const;
export type SitePageSlug = (typeof SITE_PAGE_SLUGS)[number];

export const isSitePageSlug = (value: string): value is SitePageSlug =>
  (SITE_PAGE_SLUGS as readonly string[]).includes(value);

/** Public address of each page. */
export const SITE_PAGE_PATH: Record<SitePageSlug, string> = {
  about: routes.about,
  privacy: routes.privacy,
  terms: routes.terms,
  accessibility: routes.accessibility,
};

/** Field limits — the same as the CHECKs on site_pages. */
export const SITE_PAGE_LIMITS = {
  title: 200,
  description: 300,
  lead: 1000,
  /** Length of the sanitized body (checked after sanitizing). */
  body: 100_000,
} as const;

/** What a site page shows — a DB row or the built-in default. */
export interface SitePageContent {
  slug: SitePageSlug;
  title: string;
  /** Meta description (search results, link previews). */
  description: string;
  /** Plain-text introduction under the heading; empty = none. */
  lead: string;
  /** Sanitized HTML with placeholders (see `PAGE_TOKENS`). */
  body_html: string;
  /** "Last updated" date (YYYY-MM-DD); null = not shown. */
  last_reviewed: string | null;
}

/**
 * Placeholders an editor can put in the body; the website fills them in when
 * it renders the page (never stored expanded).
 */
export const PAGE_TOKENS = {
  /** The contact link (same as everywhere on the site). */
  contact: "{{contact}}",
  /** The publisher's e-mail address, as plain text. */
  email: "{{email}}",
  /** About only: the live list of data sources, as a paragraph of its own. */
  dataSources: "{{data-sources}}",
} as const;
