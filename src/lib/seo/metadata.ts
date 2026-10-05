import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALES, localePath, type Locale } from "@/features/i18n/config";
import { ORGANIZATION } from "@/config/organization";
import { absoluteUrl, alternates } from "./index";

/** Brand appended to every page title by the root layout template. */
export const TITLE_SUFFIX = ` — ${ORGANIZATION.name}`;
/** Roughly what Google shows before cutting a title or a description. */
const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

/** Default preview image for pages without their own (app/og-image.png). */
export const DEFAULT_OG_IMAGE = "/og-image.png";

/** Open Graph locale codes (language_TERRITORY). */
const OG_LOCALE: Record<Locale, string> = { en: "en_US" };

/**
 * Text cut to `max` characters at a word boundary, with an ellipsis.
 * Whitespace is collapsed first, so HTML-derived text measures honestly.
 */
export function clampText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1).replace(/\s+\S*$/, "");
  return `${cut.replace(/[\s,;:.–—-]+$/, "")}…`;
}

/**
 * Page title with the brand when it fits (≤ 60 characters together), otherwise
 * the bare title — the topic matters more than the brand in a cut-off result.
 * An optional qualifier ("Where hunger is political…") is added only if it fits.
 */
export function pageTitle(main: string, qualifier?: string): Metadata["title"] {
  const withQualifier = qualifier ? `${main} — ${qualifier}` : main;
  if (withQualifier.length + TITLE_SUFFIX.length <= TITLE_MAX) return withQualifier;
  if (main.length + TITLE_SUFFIX.length <= TITLE_MAX) return main;
  return { absolute: main };
}

/** The final `<title>` text a page ends up with (also for og:title). */
export function fullTitle(title: Metadata["title"]): string {
  if (typeof title === "string") return `${title}${TITLE_SUFFIX}`;
  if (title && typeof title === "object" && "absolute" in title) return String(title.absolute);
  return ORGANIZATION.name;
}

export interface PageSeo {
  /** Language of the route (`/cs/...` = cs). */
  locale: Locale;
  /** Path without the language prefix, "/" for the home page. */
  path: string;
  title: Metadata["title"];
  description: string;
  /** The description was written for search by an editor (DB caps it): keep it whole. */
  authoredDescription?: boolean;
  /**
   * Language of the text when it differs from the route (an untranslated
   * original shown under /cs) — the canonical URL then points to that version.
   */
  contentLocale?: Locale;
  /** Languages the page really exists in (hreflang); default all. */
  languages?: readonly Locale[];
  /** Preview image; without it the segment's opengraph-image or the default. */
  image?: string | null;
  /** True when the route segment has its own opengraph-image file. */
  ownImage?: boolean;
  type?: "website" | "article" | "profile";
  article?: {
    published?: string;
    modified?: string;
    authors?: string[];
    section?: string;
    tags?: string[];
  };
  /** Keep out of the index (thin, private or duplicate pages); links are still followed. */
  noindex?: boolean;
  /** The page has a markdown version at `<path>.md` (llms.txt convention). */
  markdown?: boolean;
  keywords?: string[];
  other?: Metadata["other"];
}

/**
 * Metadata of a public page from one place (ARCHITEKTURA 13.4): canonical and
 * hreflang, Open Graph with the right URL and locale, a large Twitter card,
 * robots. Descriptions are cut to what search engines show.
 */
export function pageMetadata(seo: PageSeo): Metadata {
  const content = seo.contentLocale ?? seo.locale;
  const languages = seo.languages ?? LOCALES;
  const links = alternates(seo.path, content, languages);
  const canonical = absoluteUrl(localePath(content, seo.path));
  const description = seo.authoredDescription
    ? seo.description.trim()
    : clampText(seo.description, DESCRIPTION_MAX);
  const title = fullTitle(seo.title);
  const image = seo.image ?? (seo.ownImage ? undefined : DEFAULT_OG_IMAGE);

  // Next merges metadata key by key and a key present as `undefined` replaces the
  // parent's value (the segment's opengraph-image, the root robots with
  // max-image-preview) — so unset keys are left out entirely, never set to undefined.
  return {
    title: seo.title,
    description,
    ...(seo.keywords?.length ? { keywords: seo.keywords } : {}),
    alternates: {
      ...links,
      ...(seo.markdown
        ? { types: { "text/markdown": absoluteUrl(`${localePath(content, seo.path)}.md`) } }
        : {}),
    },
    openGraph: {
      type: seo.type ?? "website",
      siteName: ORGANIZATION.name,
      url: canonical,
      locale: OG_LOCALE[content],
      alternateLocale: languages.filter((code) => code !== content).map((code) => OG_LOCALE[code]),
      title,
      description,
      ...(image ? { images: [{ url: image, alt: title }] } : {}),
      ...(seo.type === "article" && seo.article
        ? {
            publishedTime: seo.article.published,
            modifiedTime: seo.article.modified ?? seo.article.published,
            authors: seo.article.authors,
            section: seo.article.section,
            tags: seo.article.tags,
          }
        : {}),
    },
    // No `twitter` here: Next copies title, description and image (including a
    // segment's opengraph-image file) from Open Graph; the card type is in the root layout.
    ...(seo.noindex
      ? { robots: { index: false, follow: true, googleBot: { index: false, follow: true } } }
      : {}),
    ...(seo.other ? { other: seo.other } : {}),
  };
}

/**
 * English-only page (legal texts): /cs shows the English original under a note,
 * so the Czech URL canonicalizes to the English one and has no hreflang of its own.
 */
export function englishOnlyMetadata(
  locale: Locale,
  path: string,
  title: string,
  description: string,
): Metadata {
  return pageMetadata({
    locale,
    path,
    title,
    description,
    contentLocale: DEFAULT_LOCALE,
    languages: [DEFAULT_LOCALE],
  });
}
