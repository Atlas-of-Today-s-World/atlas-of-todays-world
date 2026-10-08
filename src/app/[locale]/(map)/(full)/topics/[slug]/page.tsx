import type { Metadata } from "next";
import { EncyclopediaArticle } from "@/features/entries/components/EncyclopediaArticle";
import { getEncyclopediaEntries, getEncyclopediaEntry } from "@/features/entries/queries";
import { redirectOrNotFound } from "@/features/redirects/queries";
import { countriesOf } from "@/features/geography/model";
import { getAtlas } from "@/features/geography/queries";
import { localeFrom } from "@/features/i18n/request";
import {
  clampText,
  DEFAULT_OG_IMAGE,
  DESCRIPTION_MAX,
  pageMetadata,
  pageTitle,
} from "@/lib/seo/metadata";
import {
  articleNode,
  breadcrumbNode,
  faqNode,
  graph,
  pageUrl,
  webPageNode,
} from "@/lib/seo/jsonld";
import { getMessages } from "@/features/i18n/messages";
import { JsonLd } from "@/components/JsonLd";
import { routes } from "@/config/routes";

// true, so an entry published in the admin shows up immediately, without a new build.
export const dynamicParams = true;

export async function generateStaticParams() {
  const entries = await getEncyclopediaEntries();
  return entries.map((item) => ({ slug: item.slug }));
}

/** Default meta description: the summary, else the summary bullets, cut to what search engines show. */
const seoDescription = (item: { summary: string; summaryPoints: string[] }) =>
  clampText(item.summary || item.summaryPoints.join(" "), DESCRIPTION_MAX);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await localeFrom(params);
  const item = await getEncyclopediaEntry(slug, locale);
  if (!item) return {};
  // The writer's SEO fields win; otherwise defaults derived from the article.
  return pageMetadata({
    locale,
    path: routes.topic(item.slug),
    title: pageTitle(item.seo.title ?? item.title),
    description: item.seo.description ?? seoDescription(item),
    authoredDescription: Boolean(item.seo.description),
    // Without a translation /cs is a copy of the original — the canonical URL is the original's.
    contentLocale: item.locale,
    languages: item.languages,
    image: item.seo.image,
    ownImage: !item.seo.image,
    noindex: item.seo.noindex,
    type: "article",
    markdown: true,
    keywords: item.seo.keywords,
    article: {
      published: item.published,
      modified: item.updated ?? item.published,
      authors: item.author ? [item.author] : undefined,
      section: getMessages(item.locale).categories[item.category] ?? item.category,
      tags: item.seo.keywords,
    },
  });
}

export default async function EntryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  const locale = await localeFrom(params);
  const [item, atlas] = await Promise.all([getEncyclopediaEntry(slug, locale), getAtlas(locale)]);
  // Unknown URL: redirect (changed slug), otherwise 404.
  if (!item) return redirectOrNotFound(routes.topic(slug), locale);

  const region = item.region ? atlas.regionBySlug.get(item.region) : undefined;
  // Canonical URL: the language the text is in (an untranslated original under /cs points to it).
  const url = pageUrl(routes.topic(item.slug), item.locale);
  const words = [item.html, ...item.chapters.map((chapter) => chapter.html)]
    .join(" ")
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

  return (
    <>
      <EncyclopediaArticle item={item} atlas={atlas} share />

      <JsonLd
        data={graph(
          webPageNode({
            url,
            name: item.seo.title ?? item.title,
            description: item.seo.description ?? seoDescription(item),
            locale: item.locale,
            image: item.seo.image ?? item.hero,
            modified: item.updated ?? item.published,
            about: `${url}#article`,
            // GEO: the answer-first summary and key points are what an assistant should read out.
            speakable: ["#in-short", "#key-points"],
            breadcrumb: breadcrumbNode(
              [
                { name: "Atlas of Today's World", path: "/" },
                ...(region ? [{ name: region.name, path: routes.region(region.slug) }] : []),
                { name: item.title, path: routes.topic(item.slug) },
              ],
              locale,
            ),
          }),
          articleNode({
            kind: "entry",
            url,
            headline: item.seo.title ?? item.title,
            description: item.seo.description ?? seoDescription(item),
            // GEO: a self-contained answer engines can quote, else the summary bullets.
            abstract:
              item.seo.geoSummary ??
              (item.summaryPoints.length ? item.summaryPoints.join(" ") : undefined),
            images: [
              item.seo.image,
              item.hero,
              ...(item.seo.image || item.hero ? [] : [DEFAULT_OG_IMAGE]),
            ],
            published: item.published,
            modified: item.updated ?? item.published,
            locale: item.locale,
            author: item.authorProfile
              ? {
                  name: item.authorProfile.name,
                  slug: item.authorProfile.slug,
                  description: item.authorProfile.bio,
                  image: item.authorProfile.photo,
                }
              : item.author
                ? { name: item.author, slug: item.authorSlug }
                : null,
            section: getMessages(item.locale).categories[item.category] ?? item.category,
            keywords: item.seo.keywords,
            wordCount: words,
            about: countriesOf(atlas, item.countries),
            location: region ?? null,
            citations: item.tiles.flatMap((tile) =>
              tile.resources.map((resource) => ({
                title: resource.title,
                url: resource.url,
                source: resource.source,
              })),
            ),
            parts: item.chapters.map((chapter, index) => ({
              name: chapter.title,
              url: `${url}#topic-${index + 1}`,
              audio: chapter.audio,
            })),
          }),
          faqNode(url, item.faq),
        )}
      />
    </>
  );
}
