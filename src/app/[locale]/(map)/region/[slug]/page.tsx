import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContentRail from "@/components/ContentRail";
import Portrait, { newsCards } from "@/components/portrait/Portrait";
import MapFocus from "@/components/map/MapFocus";
import {
  entriesOfRegion,
  getEncyclopediaEntries,
  getEntries,
  getPlannedEntries,
  thematicEntries,
} from "@/features/entries/queries";
import { countriesOf } from "@/features/geography/model";
import { getAtlas } from "@/features/geography/queries";
import { getRequestLocale, localeFrom } from "@/features/i18n/request";
import { getPortrait } from "@/features/portraits/queries";
import { groupStats, population } from "@/lib/region-stats";
import { geoMeta } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo/metadata";
import {
  breadcrumbNode,
  faqNode,
  graph,
  groupPlaceNode,
  ids,
  pageUrl,
  webPageNode,
} from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";

// true: with false, Next returns 404 after revalidateTag (an admin write) even for
// existing pages (NoFallbackError). An unknown slug ends up in notFound().
export const dynamicParams = true;

export async function generateStaticParams() {
  const { regions } = await getAtlas();
  return regions.map((region) => ({ slug: region.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await localeFrom(params);
  const region = (await getAtlas(locale)).regionBySlug.get(slug);
  if (!region) return {};
  return pageMetadata({
    locale,
    path: `/region/${region.slug}`,
    title: region.name,
    description: region.summary,
    ownImage: true,
    other: geoMeta({ lat: region.center[1], lon: region.center[0], placename: region.name }),
  });
}

/**
 * Region portrait. The short version is gone – the brief wants one full portrait
 * with no intermediate step, so `/region/[slug]/full` just redirects (see next.config.ts).
 */
export default async function RegionPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  const locale = await localeFrom(params);
  const atlas = await getAtlas(locale);
  const region = atlas.regionBySlug.get(slug);
  if (!region) notFound();

  const countries = countriesOf(atlas, region.countries);
  const [entries, encyclopedia, upcoming, dossier] = await Promise.all([
    getEntries(getRequestLocale()),
    getEncyclopediaEntries(getRequestLocale()),
    getPlannedEntries(),
    getPortrait("region", region.slug),
  ]);
  const newsItems = entriesOfRegion(entries, region.slug);

  return (
    <>
      <MapFocus
        center={region.center}
        zoom={region.zoom}
        regionCountries={region.countries}
        regionStroke={region.stroke}
      />
      <ContentRail wide>
        <Portrait
          subject={{
            kind: "region",
            name: region.name,
            summary: region.summary,
            hero: region.hero,
            countries: countries.map(({ slug, name }) => ({ slug, name })),
            population: population(countries),
          }}
          news={newsCards(newsItems)}
          entries={thematicEntries(
            entriesOfRegion(encyclopedia, region.slug),
            entriesOfRegion(upcoming, region.slug),
          )}
          dossier={dossier}
          stats={groupStats(countries, atlas.indicatorById, getRequestLocale())}
        />
      </ContentRail>

      <JsonLd
        data={graph(
          webPageNode({
            url: pageUrl(`/region/${region.slug}`, locale),
            name: region.name,
            description: region.summary,
            locale,
            about: ids.region(region.slug),
            image: region.hero,
            breadcrumb: breadcrumbNode(
              [
                { name: "Atlas of Today's World", path: "/" },
                { name: region.name, path: `/region/${region.slug}` },
              ],
              locale,
            ),
          }),
          {
            ...groupPlaceNode({
              kind: "region",
              slug: region.slug,
              name: region.name,
              description: region.summary,
              locale,
              center: region.center,
              image: region.hero,
              countries,
            }),
            subjectOf: newsItems.map((item) => ({
              "@type": "NewsArticle",
              headline: item.title,
              url: pageUrl(`/news/${item.slug}`, locale),
            })),
          },
          faqNode(pageUrl(`/region/${region.slug}`, locale), dossier.faq ?? []),
        )}
      />
    </>
  );
}
