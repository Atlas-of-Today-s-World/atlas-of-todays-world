import type { Metadata } from "next";
import { preload } from "react-dom";
import { PHOTO_WIDTH, photoUrl } from "@/lib/images";
import { safeUrl } from "@/lib/security/urls";
import { JsonLd } from "@/components/JsonLd";
import { getAtlas } from "@/features/geography/queries";
import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { TopicsBrowser } from "@/features/topics/components/TopicsBrowser";
import { topicIndex } from "@/features/topics/related";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbNode, graph, itemListNode, pageUrl, webPageNode } from "@/lib/seo/jsonld";
import { routes } from "@/config/routes";

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = await localeFrom(params);
  const t = getMessages(locale).topics;
  return pageMetadata({
    locale,
    path: routes.topics,
    title: t.metaTitle,
    description: t.description,
  });
}

/** Topics: every encyclopedia dossier as a photo card, full width over the map. */
export default async function TopicsPage({ params }: Params) {
  const locale = await localeFrom(params);
  const t = getMessages(locale).topics;
  const atlas = await getAtlas(locale);
  const { counts, entries } = await topicIndex(atlas);
  const cards = entries.map((item) => ({
    slug: item.slug,
    title: item.title,
    summary: item.summary,
    hero: item.hero,
    place: item.region ? (atlas.regionBySlug.get(item.region)?.name ?? null) : null,
  }));
  // The first card's photo is the page's largest element, but as a CSS background
  // the browser finds it late: announce it in <head> (Largest Contentful Paint).
  const firstPhoto = safeUrl(cards[0]?.hero);
  if (firstPhoto)
    preload(photoUrl(firstPhoto, PHOTO_WIDTH.card), { as: "image", fetchPriority: "high" });
  const filters = { country: counts.countries, region: counts.regions, issue: counts.issues };
  const pick = (keys: string[], name: (key: string) => string | undefined) =>
    Object.fromEntries(keys.flatMap((key) => (name(key) ? [[key, name(key) as string]] : [])));
  const names = {
    country: pick(Object.keys(counts.countries), (key) => atlas.countryByIso3.get(key)?.name),
    region: pick(Object.keys(counts.regions), (key) => atlas.regionBySlug.get(key)?.name),
    issue: pick(Object.keys(counts.issues), (key) => atlas.issueBySlug.get(key)?.name),
  };

  return (
    <>
      {/* The static render lists everything; the filter and the search run in the browser. */}
      <TopicsBrowser
        heading={
          <>
            <h1 className="font-display text-[34px] font-bold tracking-tight sm:text-[44px]">
              {t.title}
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
              {t.intro}
            </p>
          </>
        }
        items={cards}
        filters={filters}
        names={names}
        regionOf={Object.fromEntries(
          Object.keys(counts.countries).flatMap((iso3) => {
            const region = atlas.countryByIso3.get(iso3)?.region?.name;
            return region ? [[iso3, region]] : [];
          }),
        )}
      />

      <JsonLd
        data={graph(
          webPageNode({
            url: pageUrl(routes.topics, locale),
            name: t.title,
            description: t.description,
            locale,
            type: "CollectionPage",
            breadcrumb: breadcrumbNode(
              [
                { name: "Atlas of Today's World", path: "/" },
                { name: t.title, path: routes.topics },
              ],
              locale,
            ),
          }),
          itemListNode(
            t.title,
            entries.map((item) => ({
              name: item.title,
              url: pageUrl(routes.topic(item.slug), locale),
            })),
          ),
        )}
      />
    </>
  );
}
