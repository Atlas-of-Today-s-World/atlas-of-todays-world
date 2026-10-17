import { getSiteSettings } from "@/features/site/queries";
import { JsonLd } from "@/components/JsonLd";
import { getAtlas } from "@/features/geography/queries";
import { getMessagesFor, localeFrom } from "@/lib/i18n/request";
import { TopicsBrowser } from "@/features/topics/components/TopicsBrowser";
import { topicIndex } from "@/features/topics/related";
import { staticPageMetadata } from "@/features/seo/metadata";
import { collectionPageGraph } from "@/features/seo/jsonld";
import { routes } from "@/config/routes";

export const generateMetadata = staticPageMetadata("topics", routes.entries);

/** Topics: every encyclopedia dossier as a photo card, full width over the map. */
export default async function TopicsPage({ params }: PageProps<"/[locale]/entries">) {
  const locale = await localeFrom(params);
  const t = (await getMessagesFor(locale)).topics;
  const atlas = await getAtlas(locale);
  const site = await getSiteSettings();
  const { counts, entries } = await topicIndex(atlas);
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
      {/* The static render lists everything; the filter and the search run in the browser. */}
      <TopicsBrowser
        title={t.title}
        intro={t.intro}
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
        data={collectionPageGraph({
          path: routes.entries,
          name: t.title,
          description: t.description,
          locale,
          site,
          items: entries.map((item) => ({ name: item.title, path: routes.entry(item.slug) })),
        })}
      />
    </>
  );
}
