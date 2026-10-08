import type { Metadata } from "next";
import { NewsArticle } from "@/features/entries/components/NewsArticle";
import { redirectOrNotFound } from "@/features/redirects/queries";
import { getEntries, getEntry } from "@/features/entries/queries";
import { countriesOf } from "@/features/geography/model";
import { getAtlas } from "@/features/geography/queries";
import { localeFrom } from "@/features/i18n/request";
import { geoMeta } from "@/lib/seo";
import { DEFAULT_OG_IMAGE, pageMetadata, pageTitle } from "@/lib/seo/metadata";
import { articleNode, breadcrumbNode, graph, pageUrl, webPageNode } from "@/lib/seo/jsonld";
import { getMessages } from "@/features/i18n/messages";
import { JsonLd } from "@/components/JsonLd";
import { routes } from "@/config/routes";

// true, so a news item added in the admin shows up immediately, without a new build.
export const dynamicParams = true;

export async function generateStaticParams() {
  const entries = await getEntries();
  return entries.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await localeFrom(params);
  const [item, atlas] = await Promise.all([getEntry(slug, locale), getAtlas(locale)]);
  if (!item) return {};
  const region = item.region ? atlas.regionBySlug.get(item.region) : undefined;
  return pageMetadata({
    locale,
    path: routes.news(item.slug),
    title: pageTitle(item.title),
    description: item.summary,
    // Without a translation /cs is a copy of the original — the canonical URL is the original's.
    contentLocale: item.locale,
    languages: item.languages,
    ownImage: true,
    type: "article",
    markdown: true,
    article: {
      published: item.published,
      modified: item.updated ?? item.published,
      authors: item.author ? [item.author] : undefined,
      section: getMessages(item.locale).categories[item.category] ?? item.category,
      tags: [region?.name ?? ""].filter(Boolean),
    },
    keywords: [item.title, item.category, region?.name ?? ""].filter(Boolean),
    other: region
      ? geoMeta({ lat: region.center[1], lon: region.center[0], placename: region.name })
      : undefined,
  });
}

export default async function NewsPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  const locale = await localeFrom(params);
  const [item, atlas] = await Promise.all([getEntry(slug, locale), getAtlas(locale)]);
  // Unknown URL: redirect (changed slug), otherwise 404.
  if (!item) return redirectOrNotFound(routes.news(slug), locale);

  const region = item.region ? atlas.regionBySlug.get(item.region) : undefined;
  const issue = item.issue ? atlas.issueBySlug.get(item.issue) : undefined;
  const countriesCovered = countriesOf(atlas, item.countries);
  // Canonical URL: the language the text is in (an untranslated original under /cs points to it).
  const url = pageUrl(routes.news(item.slug), item.locale);

  return (
    <>
      <NewsArticle item={item} atlas={atlas} />

      <JsonLd
        data={graph(
          webPageNode({
            url,
            name: item.title,
            description: item.summary,
            locale: item.locale,
            image: item.hero,
            modified: item.updated ?? item.published,
            about: `${url}#article`,
            breadcrumb: breadcrumbNode(
              [
                { name: "Atlas of Today's World", path: "/" },
                { name: getMessages(locale).newsIndex.heading, path: routes.newsIndex },
                ...(region ? [{ name: region.name, path: routes.region(region.slug) }] : []),
                ...(issue ? [{ name: issue.name, path: routes.issue(issue.slug) }] : []),
                { name: item.title, path: routes.news(item.slug) },
              ],
              locale,
            ),
          }),
          articleNode({
            kind: "news",
            url,
            headline: item.title,
            description: item.summary,
            images: [item.hero ?? DEFAULT_OG_IMAGE],
            published: item.published,
            modified: item.updated ?? item.published,
            locale: item.locale,
            author: item.author ? { name: item.author, slug: item.authorSlug } : null,
            section: getMessages(item.locale).categories[item.category] ?? item.category,
            wordCount: item.html
              .replace(/<[^>]+>/g, " ")
              .split(/\s+/)
              .filter(Boolean).length,
            about: countriesCovered,
            location: region ?? null,
          }),
        )}
      />
    </>
  );
}
