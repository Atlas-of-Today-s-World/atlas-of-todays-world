import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { TOPICS_PATH } from "@/config/navigation";
import { getEncyclopediaEntries } from "@/features/entries/queries";
import {
  TopicsBrowser,
  type PlaceOption,
  type TopicCardData,
} from "@/features/topics/components/TopicsBrowser";
import { matchesFilter, type PlaceIndex, type TopicFilterKind } from "@/features/topics/filter";
import { getAtlas } from "@/features/geography/queries";
import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
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
  const [entries, atlas] = await Promise.all([getEncyclopediaEntries(locale), getAtlas(locale)]);

  const cards: TopicCardData[] = entries.map((item) => ({
    slug: item.slug,
    title: item.title,
    summary: item.summary,
    hero: item.hero,
    regionName: item.region ? (atlas.regionBySlug.get(item.region)?.name ?? null) : null,
    region: item.region,
    issue: item.issue,
    countries: item.countries,
  }));
  const places: PlaceIndex = { regionOf: {}, specialsOf: {} };
  for (const country of atlas.countries) {
    if (country.region) places.regionOf[country.iso3] = country.region.slug;
  }
  for (const issue of atlas.issues) {
    for (const iso3 of issue.countries) (places.specialsOf[iso3] ??= []).push(issue.slug);
  }
  // Only places that have at least one topic, alphabetically.
  const offer = (kind: TopicFilterKind, list: PlaceOption[]) =>
    list
      .filter((option) =>
        cards.some((card) => matchesFilter(card, { kind, value: option.value }, places)),
      )
      .sort((a, b) => a.label.localeCompare(b.label, locale));
  const options: Record<TopicFilterKind, PlaceOption[]> = {
    country: offer(
      "country",
      atlas.countries.map((country) => ({ value: country.iso3, label: country.name })),
    ),
    region: offer(
      "region",
      atlas.regions.map((region) => ({ value: region.slug, label: region.name })),
    ),
    special: offer(
      "special",
      atlas.issues.map((issue) => ({ value: issue.slug, label: issue.name })),
    ),
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

      <TopicsBrowser topics={cards} options={options} places={places} />

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
