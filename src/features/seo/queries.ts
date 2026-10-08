import "server-only";
import { unstable_cache } from "next/cache";
import { getAuthors } from "@/features/authors/queries";
import {
  getEncyclopediaEntries,
  getEncyclopediaEntry,
  getEntries,
  getEntry,
  type EntrySummary,
} from "@/features/entries/queries";
import { getAtlas } from "@/features/geography/queries";
import type { Atlas } from "@/features/geography/types";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/features/i18n/config";
import { format, getMessages } from "@/features/i18n/messages";
import { articlePath, LEGAL_NAV, NEWSLETTER_PATH, TOPICS_PATH } from "@/config/navigation";
import { ORGANIZATION } from "@/config/organization";
import { MEMBERSHIP_PATH } from "@/features/membership/config";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { formatValue } from "@/lib/indicators";
import { absoluteUrl } from "@/lib/seo";
import { llmsFullTxt, llmsTxt, type LlmsDocument, type LlmsLink } from "@/lib/seo/llms";
import { clampText } from "@/lib/seo/metadata";
import { latest, type FeedItem, type SitemapUrl } from "@/lib/seo/xml";
import { createPublicClient } from "@/lib/supabase/public";
import { articleDocument, articleUrl, type ArticleKind } from "./documents";

/**
 * Data for the machine-readable views of the Atlas: sitemaps, feeds and
 * llms.txt. Everything comes from the cached public queries, so these files
 * refresh with the same cache tags as the pages (ISR).
 */

type Stamps = Record<string, string>;

const toStamps = <K extends string>(
  rows: ({ updated_at: string } & Record<K, string>)[] | null,
  key: K,
): Stamps => Object.fromEntries((rows ?? []).map((row) => [row[key], row.updated_at]));

/** When each region, global issue, country and data layer last changed (sitemap lastmod). */
const getLastModified = unstable_cache(
  async () => {
    const db = createPublicClient();
    const [regions, issues, countries, indicators] = await Promise.all([
      db.from("regions").select("slug, updated_at").limit(1000),
      db.from("special_regions").select("slug, updated_at").limit(1000),
      db.from("countries").select("slug, updated_at").limit(1000),
      db.from("indicators").select("id, updated_at").limit(1000),
    ]);
    for (const result of [regions, issues, countries, indicators]) {
      if (result.error) throw new Error(`[seo] ${result.error.message}`);
    }
    return {
      region: toStamps(regions.data, "slug"),
      issue: toStamps(issues.data, "slug"),
      country: toStamps(countries.data, "slug"),
      indicator: toStamps(indicators.data, "id"),
    };
  },
  ["seo-last-modified"],
  { tags: [tags.atlas], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

const articleDate = (item: EntrySummary) => item.updated ?? item.published;

// ---------------------------------------------------------------------------
// Sitemaps
// ---------------------------------------------------------------------------

export const SITEMAPS = [
  "pages",
  "regions",
  "countries",
  "data",
  "news",
  "entries",
  "authors",
  "google-news",
] as const;
export type SitemapName = (typeof SITEMAPS)[number];

/** Google News takes only articles from the last two days. */
const NEWS_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

/** All URLs of the site, grouped into the child sitemaps of /sitemap.xml. */
export async function getSitemaps(now = Date.now()): Promise<Record<SitemapName, SitemapUrl[]>> {
  const [atlas, news, entries, authors, stamps] = await Promise.all([
    getAtlas(),
    getEntries(),
    getEncyclopediaEntries(),
    getAuthors(),
    getLastModified(),
  ]);
  const dataChanged = latest(Object.values(stamps.indicator));
  const articles = [...news, ...entries];
  const byAuthor = new Map<string, string[]>();
  for (const item of articles) {
    if (!item.authorSlug) continue;
    byAuthor.set(item.authorSlug, [
      ...(byAuthor.get(item.authorSlug) ?? []),
      articleDate(item) ?? "",
    ]);
  }
  const article = (kind: ArticleKind) => (item: EntrySummary) => ({
    path: articlePath(kind, item.slug),
    languages: item.languages,
    lastmod: articleDate(item),
    images: [item.hero],
  });

  return {
    pages: [
      { path: "/", lastmod: latest([dataChanged, ...articles.map(articleDate)]) },
      { path: "/news", lastmod: latest(news.map(articleDate)) },
      { path: TOPICS_PATH, lastmod: latest(entries.map(articleDate)) },
      { path: "/about", lastmod: dataChanged },
      { path: NEWSLETTER_PATH },
      { path: MEMBERSHIP_PATH },
      ...LEGAL_NAV.map((item) => ({ path: item.href, languages: [DEFAULT_LOCALE] })),
    ],
    regions: [
      ...atlas.regions.map((region) => ({
        path: `/region/${region.slug}`,
        lastmod: latest([stamps.region[region.slug], dataChanged]),
        images: [region.hero],
      })),
      ...atlas.issues.map((issue) => ({
        path: `/global-issue/${issue.slug}`,
        lastmod: latest([stamps.issue[issue.slug], dataChanged]),
        images: [issue.hero],
      })),
    ],
    countries: atlas.countries.map((country) => ({
      path: `/country/${country.slug}`,
      lastmod: latest([stamps.country[country.slug], dataChanged]),
    })),
    data: atlas.indicators.map((indicator) => ({
      path: `/view/${indicator.id}`,
      lastmod: stamps.indicator[indicator.id],
    })),
    news: news.map(article("news")),
    entries: entries.map(article("entry")),
    authors: authors
      .filter((author) => byAuthor.has(author.slug))
      .map((author) => ({
        path: `/authors/${author.slug}`,
        lastmod: latest(byAuthor.get(author.slug) ?? []),
      })),
    "google-news": news
      .filter((item) => item.published && now - Date.parse(item.published) < NEWS_WINDOW_MS)
      .map((item) => ({
        path: `/news/${item.slug}`,
        languages: [item.languages[0] ?? DEFAULT_LOCALE],
        news: {
          title: item.title,
          published: item.published ?? "",
          language: item.languages[0] ?? DEFAULT_LOCALE,
        },
      })),
  };
}

// ---------------------------------------------------------------------------
// Feeds
// ---------------------------------------------------------------------------

/** Latest news and entries (full text) for the RSS and Atom feeds of a language. */
export async function getFeedItems(locale: Locale, limit = 30): Promise<FeedItem[]> {
  const [news, entries] = await Promise.all([getEntries(), getEncyclopediaEntries()]);
  const t = getMessages(locale);
  const recent = [
    ...news.map((item) => ({ kind: "news" as const, item })),
    ...entries.map((item) => ({ kind: "entry" as const, item })),
  ]
    .filter(({ item }) => item.published)
    .sort((a, b) => Date.parse(b.item.published ?? "") - Date.parse(a.item.published ?? ""))
    .slice(0, limit);

  const full = await Promise.all(
    recent.map(({ kind, item }) =>
      kind === "news" ? getEntry(item.slug, locale) : getEncyclopediaEntry(item.slug, locale),
    ),
  );
  return recent.flatMap(({ kind }, index) => {
    const item = full[index];
    if (!item?.published) return [];
    return [
      {
        title: item.title,
        url: articleUrl(kind, item),
        summary: item.summary,
        html: item.html,
        published: item.published,
        updated: item.updated,
        author: item.author ?? t.article.editorialTeam,
        category: t.categories[item.category] ?? item.category,
        image: item.hero,
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// llms.txt
// ---------------------------------------------------------------------------

const url = (locale: Locale, path: string) => absoluteUrl(localePath(locale, path));

function sections(atlas: Atlas, news: EntrySummary[], entries: EntrySummary[], locale: Locale) {
  const t = getMessages(locale);
  const s = t.seo;
  const date = (item: EntrySummary) => (item.published ? `${item.published} — ` : "");
  return [
    {
      title: s.sectionEntries,
      links: entries.map((item) => ({
        name: item.title,
        url: url(locale, articlePath("entry", item.slug)),
        note: `${date(item)}${clampText(item.summary, 300)}`,
      })),
    },
    {
      title: s.sectionNews,
      links: news.slice(0, 50).map((item) => ({
        name: item.title,
        url: url(locale, `/news/${item.slug}`),
        note: `${date(item)}${clampText(item.summary, 300)}`,
      })),
    },
    {
      title: s.sectionRegions,
      links: atlas.regions.map((region) => ({
        name: region.name,
        url: url(locale, `/region/${region.slug}`),
        note: clampText(region.summary, 300),
      })),
    },
    {
      title: s.sectionIssues,
      links: atlas.issues.map((issue) => ({
        name: issue.name,
        url: url(locale, `/global-issue/${issue.slug}`),
        note: clampText(`${issue.subtitle}. ${issue.summary}`, 300),
      })),
    },
    {
      title: s.sectionData,
      links: atlas.indicators.map((indicator) => ({
        name: indicator.label,
        url: url(locale, `/view/${indicator.id}`),
        note: format(s.dataNote, {
          description: clampText(indicator.description, 240),
          source: indicator.source,
          year: String(indicator.latestYear ?? ""),
          count: String(indicator.countryCount),
        }),
      })),
    },
    {
      title: s.sectionAbout,
      links: [
        { name: t.about.title, url: url(locale, "/about"), note: t.about.description },
        { name: t.topics.title, url: url(locale, TOPICS_PATH), note: t.topics.description },
        { name: t.patrons.title, url: url(locale, MEMBERSHIP_PATH), note: t.patrons.description },
        { name: "RSS", url: url(locale, "/feed.xml") },
        { name: "Sitemap", url: absoluteUrl("/sitemap.xml") },
      ],
    },
  ];
}

/** Country profiles as the "Optional" section (long, but every one is a real page). */
const countryLinks = (atlas: Atlas, locale: Locale): LlmsLink[] =>
  atlas.countries.map((country) => ({
    name: country.name,
    url: url(locale, `/country/${country.slug}`),
    note: country.region?.name,
  }));

function head(atlas: Atlas, news: EntrySummary[], entries: EntrySummary[], locale: Locale) {
  const s = getMessages(locale).seo;
  return llmsTxt({
    title: ORGANIZATION.name,
    summary: ORGANIZATION.description,
    paragraphs: [
      format(s.llmsIntro, { legalName: ORGANIZATION.legalName }),
      s.llmsUse,
      s.llmsCite,
      format(s.llmsFormats, {
        full: url(locale, "/llms-full.txt"),
        rss: url(locale, "/feed.xml"),
        atom: url(locale, "/atom.xml"),
        sitemap: absoluteUrl("/sitemap.xml"),
      }),
    ],
    sections: sections(atlas, news, entries, locale),
    optional: countryLinks(atlas, locale),
  });
}

/** /llms.txt — the map of the site for language models. */
export async function getLlmsTxt(locale: Locale): Promise<string> {
  const [atlas, news, entries] = await Promise.all([
    getAtlas(locale),
    getEntries(),
    getEncyclopediaEntries(),
  ]);
  return head(atlas, news, entries, locale);
}

/** One table of the latest value of every indicator for every country, with sources. */
function countryData(atlas: Atlas, locale: Locale): LlmsDocument {
  const s = getMessages(locale).seo;
  const columns = atlas.indicators;
  const header = `| ${s.country} | ${s.region} | ${columns.map((c) => c.shortLabel).join(" | ")} |`;
  const rows = atlas.countries.map((country) => {
    const cells = columns.map((indicator) => {
      const value = indicator.values[country.iso3];
      return value ? `${formatValue(indicator, value.value, locale)} (${value.year})` : "—";
    });
    return `| [${country.name}](${url(locale, `/country/${country.slug}`)}) | ${country.region?.name ?? ""} | ${cells.join(" | ")} |`;
  });
  const sources = columns.map(
    (indicator) =>
      `- ${indicator.shortLabel}: ${indicator.label} — ${indicator.source} (${indicator.sourceUrl})`,
  );
  return {
    title: s.countryData,
    url: url(locale, "/"),
    facts: [],
    markdown: [
      sources.join("\n"),
      [header, `|${" --- |".repeat(columns.length + 2)}`, ...rows].join("\n"),
    ].join("\n\n"),
  };
}

/** /llms-full.txt — llms.txt plus the full text of every article and the country data. */
export async function getLlmsFullTxt(locale: Locale): Promise<string> {
  const [atlas, news, entries] = await Promise.all([
    getAtlas(locale),
    getEntries(),
    getEncyclopediaEntries(),
  ]);
  const [fullEntries, fullNews] = await Promise.all([
    Promise.all(entries.map((item) => getEncyclopediaEntry(item.slug, locale))),
    Promise.all(news.map((item) => getEntry(item.slug, locale))),
  ]);
  const documents = [
    ...fullEntries.flatMap((item) => (item ? [articleDocument("entry", item, atlas)] : [])),
    ...fullNews.flatMap((item) => (item ? [articleDocument("news", item, atlas)] : [])),
    ...atlas.regions.map((region) => ({
      title: region.name,
      url: url(locale, `/region/${region.slug}`),
      facts: [],
      markdown: [
        region.summary,
        `${getMessages(locale).seo.countries}: ${region.countries
          .map((iso3) => atlas.countryByIso3.get(iso3)?.name)
          .filter(Boolean)
          .join(", ")}`,
      ].join("\n\n"),
    })),
    ...atlas.issues.map((issue) => ({
      title: `${issue.name} — ${issue.subtitle}`,
      url: url(locale, `/global-issue/${issue.slug}`),
      facts: [],
      markdown: [
        issue.summary,
        `${getMessages(locale).seo.countries}: ${issue.countries
          .map((iso3) => atlas.countryByIso3.get(iso3)?.name)
          .filter(Boolean)
          .join(", ")}`,
      ].join("\n\n"),
    })),
    countryData(atlas, locale),
  ];
  return llmsFullTxt(head(atlas, news, entries, locale), documents);
}

// ---------------------------------------------------------------------------
// Markdown versions of articles
// ---------------------------------------------------------------------------

/** An article (in the page language, else the original) with the atlas it is placed in. */
export async function getArticle(kind: ArticleKind, slug: string, locale: Locale) {
  const [item, atlas] = await Promise.all([
    kind === "news" ? getEntry(slug, locale) : getEncyclopediaEntry(slug, locale),
    getAtlas(locale),
  ]);
  return item ? { item, atlas } : null;
}
