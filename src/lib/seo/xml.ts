import { LOCALES, localePath, type Locale } from "@/features/i18n/config";
import { absoluteUrl } from "./index";

/**
 * XML documents for robots and feed readers: sitemaps (index, urlset with
 * hreflang, images and Google News) and the RSS 2.0 / Atom feeds. Pure
 * functions, tested in xml.test.ts; the routes only feed them data.
 */

/** Escapes text for element content and attribute values. */
export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

/** HTML inside CDATA; a literal `]]>` in the text is split so it can't end the section. */
const cdata = (html: string) => `<![CDATA[${html.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

const tag = (name: string, value: string | undefined) =>
  value === undefined || value === "" ? "" : `<${name}>${xmlEscape(value)}</${name}>`;

/** W3C datetime for sitemaps; dates without time stay dates. */
const w3c = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date(value).toISOString();

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n';

// ---------------------------------------------------------------------------
// Sitemaps
// ---------------------------------------------------------------------------

export interface SitemapUrl {
  /** Path without the language prefix. */
  path: string;
  /** Languages the page exists in (one <url> per language, each with all hreflang links). */
  languages?: readonly Locale[];
  lastmod?: string;
  images?: (string | null | undefined)[];
  /** Google News entry (only articles from the last two days). */
  news?: { title: string; published: string; language: Locale };
}

export function sitemapIndexXml(sitemaps: { loc: string; lastmod?: string }[]): string {
  const items = sitemaps
    .map(
      (item) =>
        `<sitemap><loc>${xmlEscape(item.loc)}</loc>${item.lastmod ? `<lastmod>${w3c(item.lastmod)}</lastmod>` : ""}</sitemap>`,
    )
    .join("\n");
  return `${XML_HEADER}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

export function urlsetXml(urls: SitemapUrl[], publication = "Atlas of Today's World"): string {
  const body = urls.flatMap((url) => {
    const languages = url.languages ?? LOCALES;
    const links =
      languages.length > 1
        ? [
            ...languages.map(
              (code) =>
                `<xhtml:link rel="alternate" hreflang="${code}" href="${xmlEscape(absoluteUrl(localePath(code, url.path)))}"/>`,
            ),
            `<xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(absoluteUrl(localePath(languages[0] ?? "en", url.path)))}"/>`,
          ].join("")
        : "";
    const images = (url.images ?? [])
      .filter((image): image is string => Boolean(image))
      .map(
        (image) =>
          `<image:image><image:loc>${xmlEscape(absoluteUrl(image))}</image:loc></image:image>`,
      )
      .join("");
    // With a Google News entry only the original language is listed.
    const listed = url.news ? [url.news.language] : languages;
    return listed.map((code) => {
      const news = url.news
        ? `<news:news><news:publication><news:name>${xmlEscape(publication)}</news:name><news:language>${code}</news:language></news:publication><news:publication_date>${w3c(url.news.published)}</news:publication_date>${tag("news:title", url.news.title)}</news:news>`
        : "";
      return `<url><loc>${xmlEscape(absoluteUrl(localePath(code, url.path)))}</loc>${links}${url.lastmod ? `<lastmod>${w3c(url.lastmod)}</lastmod>` : ""}${images}${news}</url>`;
    });
  });
  return `${XML_HEADER}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${body.join("\n")}\n</urlset>\n`;
}

/** Latest of the given dates (ISO strings), for a sitemap's lastmod. */
export function latest(dates: (string | null | undefined)[]): string | undefined {
  return dates
    .filter((date): date is string => Boolean(date))
    .reduce<string | undefined>(
      (max, date) => (!max || Date.parse(date) > Date.parse(max) ? date : max),
      undefined,
    );
}

// ---------------------------------------------------------------------------
// Feeds
// ---------------------------------------------------------------------------

export interface FeedItem {
  title: string;
  url: string;
  summary: string;
  /** Sanitized HTML of the full text. */
  html?: string;
  published: string;
  updated?: string;
  author?: string;
  category?: string;
  image?: string;
}

export interface FeedMeta {
  title: string;
  description: string;
  /** Home page of the feed's language. */
  home: string;
  /** The feed's own URL. */
  self: string;
  language: Locale;
  logo: string;
  email: string;
  publisher: string;
}

const rfc822 = (date: string) => new Date(date).toUTCString();
const iso = (date: string) => new Date(date).toISOString();

/** RSS 2.0 with full text (content:encoded), author and category. */
export function rssXml(meta: FeedMeta, items: FeedItem[]): string {
  const updated = latest(items.map((item) => item.updated ?? item.published));
  const entries = items
    .map((item) =>
      [
        "<item>",
        tag("title", item.title),
        tag("link", item.url),
        `<guid isPermaLink="true">${xmlEscape(item.url)}</guid>`,
        `<pubDate>${rfc822(item.published)}</pubDate>`,
        tag("description", item.summary),
        item.html ? `<content:encoded>${cdata(item.html)}</content:encoded>` : "",
        tag("dc:creator", item.author),
        tag("category", item.category),
        item.image
          ? `<media:content url="${xmlEscape(absoluteUrl(item.image))}" medium="image"/>`
          : "",
        "</item>",
      ].join(""),
    )
    .join("\n");
  return `${XML_HEADER}<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
${tag("title", meta.title)}${tag("link", meta.home)}${tag("description", meta.description)}${tag("language", meta.language)}${updated ? `<lastBuildDate>${rfc822(updated)}</lastBuildDate>` : ""}<atom:link href="${xmlEscape(meta.self)}" rel="self" type="application/rss+xml"/>${tag("copyright", `© ${meta.publisher}`)}${tag("managingEditor", `${meta.email} (${meta.publisher})`)}<image><url>${xmlEscape(meta.logo)}</url>${tag("title", meta.title)}${tag("link", meta.home)}</image>
${entries}
</channel>
</rss>
`;
}

/** Atom 1.0 with summary, full HTML content, author and category. */
export function atomXml(meta: FeedMeta, items: FeedItem[]): string {
  const updated = latest(items.map((item) => item.updated ?? item.published));
  const entries = items
    .map((item) =>
      [
        "<entry>",
        tag("title", item.title),
        `<link rel="alternate" type="text/html" href="${xmlEscape(item.url)}"/>`,
        tag("id", item.url),
        `<published>${iso(item.published)}</published>`,
        `<updated>${iso(item.updated ?? item.published)}</updated>`,
        `<author><name>${xmlEscape(item.author ?? meta.publisher)}</name></author>`,
        item.category ? `<category term="${xmlEscape(item.category)}"/>` : "",
        `<summary type="text">${xmlEscape(item.summary)}</summary>`,
        item.html ? `<content type="html">${xmlEscape(item.html)}</content>` : "",
        "</entry>",
      ].join(""),
    )
    .join("\n");
  return `${XML_HEADER}<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${meta.language}">
${tag("title", meta.title)}${tag("subtitle", meta.description)}${tag("id", meta.home)}<link rel="alternate" type="text/html" href="${xmlEscape(meta.home)}"/><link rel="self" type="application/atom+xml" href="${xmlEscape(meta.self)}"/>${updated ? `<updated>${iso(updated)}</updated>` : `<updated>${new Date().toISOString()}</updated>`}<author><name>${xmlEscape(meta.publisher)}</name><email>${xmlEscape(meta.email)}</email></author>${tag("logo", meta.logo)}${tag("icon", meta.logo)}${tag("rights", `© ${meta.publisher}`)}
${entries}
</feed>
`;
}
