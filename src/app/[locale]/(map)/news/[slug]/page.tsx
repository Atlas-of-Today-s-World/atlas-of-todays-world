import { getSiteSettings } from "@/features/site/queries";
import type { Metadata } from "next";
import { NewsArticle } from "@/features/topics/components/NewsArticle";
import { redirectOrNotFound } from "@/features/redirects/queries";
import { getEntries, getEntry } from "@/features/entries/queries";
import { countriesOf } from "@/features/geography/model";
import { getAtlas } from "@/features/geography/queries";
import { getMessagesFor, localeFrom } from "@/features/i18n/request";
import { articleMetaOf } from "@/features/entries/article-meta";
import { geoMeta } from "@/lib/seo";
import { pageMetadata, pageTitle } from "@/lib/seo/metadata";
import { articleNode, breadcrumbNode, graph, pageUrl, webPageNode } from "@/lib/seo/jsonld";
import { wordCount } from "@/lib/text/html";
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
}: PageProps<"/[locale]/news/[slug]">): Promise<Metadata> {
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
    // Without a translation the page shows the original — the canonical URL is the original's.
    contentLocale: item.locale,
    languages: item.languages,
    ownImage: true,
    type: "article",
    markdown: true,
    article: {
      ...(await articleMetaOf(item)),
      authors: item.author ? [item.author] : undefined,
      tags: [region?.name ?? ""].filter(Boolean),
    },
    keywords: [item.title, item.category, region?.name ?? ""].filter(Boolean),
    other: region
      ? geoMeta({ lat: region.center[1], lon: region.center[0], placename: region.name })
      : undefined,
  });
}

export default async function NewsPage({ params }: PageProps<"/[locale]/news/[slug]">) {
  const { slug } = await params;
  const locale = await localeFrom(params);
  const [item, atlas] = await Promise.all([getEntry(slug, locale), getAtlas(locale)]);
  const site = await getSiteSettings();
  // Unknown URL: redirect (changed slug), otherwise 404.
  if (!item) return redirectOrNotFound(routes.news(slug), locale);

  const region = item.region ? atlas.regionBySlug.get(item.region) : undefined;
  const issue = item.issue ? atlas.issueBySlug.get(item.issue) : undefined;
  const countriesCovered = countriesOf(atlas, item.countries);
  // Canonical URL: the language the text is in (an untranslated original points to it).
  const url = pageUrl(routes.news(item.slug), item.locale);
  const meta = await articleMetaOf(item);

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
            modified: meta.modified,
            about: `${url}#article`,
            breadcrumb: breadcrumbNode(
              site,
              [
                { name: (await getMessagesFor(locale)).newsIndex.heading, path: routes.newsIndex },
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
            images: [item.hero ?? site.ogImage],
            published: meta.published,
            modified: meta.modified,
            locale: item.locale,
            author: item.author ? { name: item.author, slug: item.authorSlug } : null,
            section: meta.section,
            wordCount: wordCount(item.html),
            about: countriesCovered,
            location: region ?? null,
          }),
        )}
      />
    </>
  );
}
