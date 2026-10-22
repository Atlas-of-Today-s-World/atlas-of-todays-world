import "server-only";
import { unstable_cache } from "next/cache";
import { BUILDER } from "@/config/organization";
import { getAuthors } from "@/features/authors/queries";
import { getOpenPositions } from "@/features/careers/queries";
import { getEncyclopediaEntries } from "@/features/entries/queries";
import type { Entry, EntrySummary } from "@/features/entries/types";
import { getEncyclopediaEntry } from "@/features/entries/topic-queries";
import { getAtlas, getIndicators } from "@/features/geography/queries";
import type { Atlas, IndicatorData } from "@/features/geography/types";
import { DEFAULT_LOCALE, localePath, LOCALES, type Locale } from "@/lib/i18n/config";
import { format, type Messages } from "@/lib/i18n/messages";
import type { SiteSettings } from "@/features/site/model";
import { getSiteSettings } from "@/features/site/queries";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { must } from "@/lib/db/result";
import { formatValue } from "@/features/geography/indicators";
import { absoluteUrl } from "@/lib/seo";
import { llmsFullTxt, llmsTxt, type LlmsDocument, type LlmsLink } from "@/lib/seo/llms";
import { clampText } from "@/features/seo/metadata";
import { latest, type FeedItem, type SitemapUrl } from "@/lib/seo/xml";
import { createPublicClient } from "@/lib/supabase/public";
import { categoryLabel } from "@/lib/content-types";
import { articleDocument, articleUrl } from "./documents";
import { routes } from "@/config/routes";
import { SKILLS_PAGE } from "@/features/skills/model";
import { getMessagesFor } from "@/lib/i18n/request";

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
    for (const result of [regions, issues, countries, indicators]) must(result, "seo");
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

export const SITEMAPS = ["pages", "regions", "countries", "data", "entries", "authors"] as const;
export type SitemapName = (typeof SITEMAPS)[number];

/** All URLs of the site, grouped into the child sitemaps of /sitemap.xml. */
export async function getSitemaps(): Promise<Record<SitemapName, SitemapUrl[]>> {
  const [atlas, entries, authors, stamps, positions] = await Promise.all([
    getAtlas(),
    getEncyclopediaEntries(),
    getAuthors(),
    getLastModified(),
    getOpenPositions(),
  ]);
  const dataChanged = latest(Object.values(stamps.indicator));
  const byAuthor = new Map<string, string[]>();
  for (const item of entries) {
    if (!item.authorSlug) continue;
    byAuthor.set(item.authorSlug, [
      ...(byAuthor.get(item.authorSlug) ?? []),
      articleDate(item) ?? "",
    ]);
  }
  const article = (item: EntrySummary) => ({
    path: routes.article("entry", item.slug),
    languages: item.languages,
    lastmod: articleDate(item),
    images: [item.hero],
  });

  return {
    pages: [
      { path: "/", lastmod: latest([dataChanged, ...entries.map(articleDate)]) },
      { path: routes.entries, lastmod: latest(entries.map(articleDate)) },
      // The overview changes with the issues themselves (and with their topic counts).
      {
        path: routes.globalIssues,
        lastmod: latest([...Object.values(stamps.issue), ...entries.map(articleDate)]),
      },
      // The list of every place changes with the places themselves (names, slugs).
      {
        path: routes.countries,
        lastmod: latest(
          [stamps.region, stamps.issue, stamps.country].flatMap((group) => Object.values(group)),
        ),
      },
      { path: routes.about, lastmod: dataChanged },
      { path: routes.newsletter },
      { path: routes.membership },
      { path: routes.careers, lastmod: latest(positions.map((position) => position.updated_at)) },
      ...positions.map((position) => ({
        path: routes.career(position.slug),
        lastmod: position.updated_at,
      })),
      // The legal pages exist whatever the footer menu (Admin → Site menus) links to;
      // the Claude skills (English only) are linked from no menu at all.
      ...[routes.privacy, routes.terms, routes.accessibility, routes.skills].map((path) => ({
        path,
        languages: [DEFAULT_LOCALE],
      })),
    ],
    regions: [
      ...atlas.regions.map((region) => ({
        path: routes.regionFull(region.slug),
        lastmod: latest([stamps.region[region.slug], dataChanged]),
        images: [region.hero],
      })),
      ...atlas.issues.map((issue) => ({
        path: routes.issueFull(issue.slug),
        lastmod: latest([stamps.issue[issue.slug], dataChanged]),
        images: [issue.hero],
      })),
    ],
    countries: atlas.countries.map((country) => ({
      path: routes.country(country.slug),
      lastmod: latest([stamps.country[country.slug], dataChanged]),
    })),
    data: atlas.indicators.map((indicator) => ({
      path: routes.view(indicator.id),
      lastmod: stamps.indicator[indicator.id],
    })),
    entries: entries.map(article),
    authors: authors
      .filter((author) => byAuthor.has(author.slug))
      .map((author) => ({
        path: routes.author(author.slug),
        lastmod: latest(byAuthor.get(author.slug) ?? []),
      })),
  };
}

// ---------------------------------------------------------------------------
// Feeds
// ---------------------------------------------------------------------------

/** Latest entries (full text) for the RSS and Atom feeds of a language. */
export async function getFeedItems(locale: Locale, limit = 30): Promise<FeedItem[]> {
  const entries = await getEncyclopediaEntries();
  const t = await getMessagesFor(locale);
  const recent = entries
    .filter((item) => item.published)
    .sort((a, b) => Date.parse(b.published ?? "") - Date.parse(a.published ?? ""))
    .slice(0, limit);

  const full = await Promise.all(recent.map((item) => getEncyclopediaEntry(item.slug, locale)));
  return full.flatMap((item) => {
    if (!item?.published) return [];
    return [
      {
        title: item.title,
        url: articleUrl("entry", item),
        summary: item.summary,
        html: item.html,
        published: item.published,
        updated: item.updated,
        author: item.author ?? t.article.editorialTeam,
        category: categoryLabel(item.category, t),
        image: item.hero,
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// llms.txt
// ---------------------------------------------------------------------------

const url = (locale: Locale, path: string) => absoluteUrl(localePath(locale, path));

/** The atlas and every data layer's values (llms.txt counts them, llms-full.txt lists them). */
interface AtlasData {
  atlas: Atlas;
  indicators: IndicatorData[];
}

const getAtlasData = async (): Promise<AtlasData> => {
  const [atlas, indicators] = await Promise.all([getAtlas(), getIndicators()]);
  return { atlas, indicators };
};

function sections(
  { atlas, indicators }: AtlasData,
  entries: EntrySummary[],
  locale: Locale,
  t: Messages,
) {
  const s = t.seo;
  const date = (item: EntrySummary) => (item.published ? `${item.published} — ` : "");
  return [
    {
      title: s.sectionEntries,
      links: entries.map((item) => ({
        name: item.title,
        url: url(locale, routes.article("entry", item.slug)),
        note: `${date(item)}${clampText(item.summary, 300)}`,
      })),
    },
    {
      title: s.sectionRegions,
      links: atlas.regions.map((region) => ({
        name: region.name,
        url: url(locale, routes.regionFull(region.slug)),
        note: clampText(region.summary, 300),
      })),
    },
    {
      title: s.sectionIssues,
      links: atlas.issues.map((issue) => ({
        name: issue.name,
        url: url(locale, routes.issueFull(issue.slug)),
        note: clampText(`${issue.subtitle}. ${issue.summary}`, 300),
      })),
    },
    {
      title: s.sectionData,
      links: indicators.map((indicator) => ({
        name: indicator.label,
        url: url(locale, routes.view(indicator.id)),
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
        { name: t.about.title, url: url(locale, routes.about), note: t.about.description },
        { name: t.topics.title, url: url(locale, routes.entries), note: t.topics.description },
        {
          name: t.globalIssues.title,
          url: url(locale, routes.globalIssues),
          note: t.globalIssues.description,
        },
        { name: t.patrons.title, url: url(locale, routes.membership), note: t.patrons.description },
        // English only, like the skills (no UI text: not a page of the encyclopedia).
        {
          name: SKILLS_PAGE.title,
          url: url(DEFAULT_LOCALE, routes.skills),
          note: SKILLS_PAGE.description,
        },
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
    url: url(locale, routes.country(country.slug)),
    note: country.region?.name,
  }));

function head(
  data: AtlasData,
  entries: EntrySummary[],
  locale: Locale,
  site: SiteSettings,
  t: Messages,
) {
  const s = t.seo;
  return llmsTxt({
    title: site.name,
    summary: site.description,
    paragraphs: [
      format(s.llmsIntro, { legalName: site.legalName }),
      s.llmsUse,
      s.llmsCite,
      format(s.llmsBuilder, { builder: BUILDER.name, url: BUILDER.url }),
      format(s.llmsFormats, {
        full: url(locale, "/llms-full.txt"),
        rss: url(locale, "/feed.xml"),
        atom: url(locale, "/atom.xml"),
        sitemap: absoluteUrl("/sitemap.xml"),
      }),
    ],
    sections: sections(data, entries, locale, t),
    optional: countryLinks(data.atlas, locale),
  });
}

/** /llms.txt — the map of the site for language models. */
export async function getLlmsTxt(locale: Locale): Promise<string> {
  const [data, entries, site, t] = await Promise.all([
    getAtlasData(),
    getEncyclopediaEntries(),
    getSiteSettings(),
    getMessagesFor(locale),
  ]);
  return head(data, entries, locale, site, t);
}

/** One table of the latest value of every indicator for every country, with sources. */
function countryData(
  { atlas, indicators: columns }: AtlasData,
  locale: Locale,
  s: Messages["seo"],
): LlmsDocument {
  const header = `| ${s.country} | ${s.region} | ${columns.map((c) => c.shortLabel).join(" | ")} |`;
  const rows = atlas.countries.map((country) => {
    const cells = columns.map((indicator) => {
      const value = indicator.values[country.iso3];
      return value ? `${formatValue(indicator, value.value, locale)} (${value.year})` : "—";
    });
    return `| [${country.name}](${url(locale, routes.country(country.slug))}) | ${country.region?.name ?? ""} | ${cells.join(" | ")} |`;
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
  const [data, entries, site, t, textsByLocale] = await Promise.all([
    getAtlasData(),
    getEncyclopediaEntries(),
    getSiteSettings(),
    getMessagesFor(locale),
    Promise.all(LOCALES.map((language) => getMessagesFor(language))),
  ]);
  const { atlas } = data;
  // Article labels follow the language of each article's text (articleDocument).
  const textsOf = (language: Locale) => textsByLocale[LOCALES.indexOf(language)] ?? t;
  const fullEntries = await Promise.all(
    entries.map((item) => getEncyclopediaEntry(item.slug, locale)),
  );
  const document = (item: Entry | null) =>
    item ? [articleDocument("entry", item, atlas, textsOf(item.locale), site.name)] : [];
  const documents = [
    ...fullEntries.flatMap(document),
    ...atlas.regions.map((region) => ({
      title: region.name,
      url: url(locale, routes.regionFull(region.slug)),
      facts: [],
      markdown: [
        region.summary,
        `${t.seo.countries}: ${region.countries
          .map((iso3) => atlas.countryByIso3.get(iso3)?.name)
          .filter(Boolean)
          .join(", ")}`,
      ].join("\n\n"),
    })),
    ...atlas.issues.map((issue) => ({
      title: `${issue.name} — ${issue.subtitle}`,
      url: url(locale, routes.issueFull(issue.slug)),
      facts: [],
      markdown: [
        issue.summary,
        `${t.seo.countries}: ${issue.countries
          .map((iso3) => atlas.countryByIso3.get(iso3)?.name)
          .filter(Boolean)
          .join(", ")}`,
      ].join("\n\n"),
    })),
    countryData(data, locale, t.seo),
  ];
  return llmsFullTxt(head(data, entries, locale, site, t), documents);
}

// ---------------------------------------------------------------------------
// Markdown versions of articles
// ---------------------------------------------------------------------------

/** An article (in the page language, else the original) with the atlas it is placed in. */
export async function getArticle(slug: string, locale: Locale) {
  const [item, atlas, site] = await Promise.all([
    getEncyclopediaEntry(slug, locale),
    getAtlas(locale),
    getSiteSettings(),
  ]);
  return item ? { item, atlas, publisher: site.name } : null;
}
