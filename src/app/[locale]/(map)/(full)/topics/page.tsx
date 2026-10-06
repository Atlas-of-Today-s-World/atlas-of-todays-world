import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { TOPICS_PATH } from "@/config/navigation";
import { getAtlas } from "@/features/geography/queries";
import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { TopicsBrowser } from "@/features/topics/components/TopicsBrowser";
import { topicIndex } from "@/features/topics/related";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbNode, graph, itemListNode, pageUrl, webPageNode } from "@/lib/seo/jsonld";

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = await localeFrom(params);
  const t = getMessages(locale).topics;
  return pageMetadata({
    locale,
    path: TOPICS_PATH,
    title: t.metaTitle,
    description: t.description,
  });
}

/** Topics: every encyclopedia dossier as a photo card, full width over the map. */
export default async function TopicsPage({ params }: Params) {
  const locale = await localeFrom(params);
  const t = getMessages(locale).topics;
  const atlas = await getAtlas(locale);
  const { counts, entries } = await topicIndex(atlas, locale);
  const cards = entries.map((item) => ({
    slug: item.slug,
    title: item.title,
    summary: item.summary,
    hero: item.hero,
    place: item.region ? (atlas.regionBySlug.get(item.region)?.name ?? null) : null,
  }));
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
      <div className="mx-auto max-w-7xl px-4 pt-12 pb-4 sm:px-8 sm:pt-16">
        <h1 className="font-display text-[34px] font-bold tracking-tight sm:text-[44px]">
          {t.title}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
          {t.intro}
        </p>
      </div>

      {/* The static render lists everything; the filter and the search run in the browser. */}
      <TopicsBrowser items={cards} filters={filters} names={names} />

      <JsonLd
        data={graph(
          webPageNode({
            url: pageUrl(TOPICS_PATH, locale),
            name: t.title,
            description: t.description,
            locale,
            type: "CollectionPage",
            breadcrumb: breadcrumbNode(
              [
                { name: "Atlas of Today's World", path: "/" },
                { name: t.title, path: TOPICS_PATH },
              ],
              locale,
            ),
          }),
          itemListNode(
            t.title,
            entries.map((item) => ({
              name: item.title,
              url: pageUrl(`/topics/${item.slug}`, locale),
            })),
          ),
        )}
      />
    </>
  );
}
