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
import { localeFrom } from "@/features/i18n/request";
import { getPortrait } from "@/features/portraits/queries";
import { groupStats, population } from "@/lib/region-stats";
import { absoluteUrl, alternates, breadcrumbJsonLd, geoCoordinates, geoMeta } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

// true: s false vrací Next po revalidateTag (zápis v administraci) 404 i pro
// existující stránky (NoFallbackError). Neznámý slug skončí přes notFound().
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
  const region = (await getAtlas(await localeFrom(params))).regionBySlug.get(slug);
  if (!region) return {};
  return {
    title: region.name,
    description: region.summary.slice(0, 180),
    alternates: alternates(`/region/${region.slug}`, await localeFrom(params)),
    openGraph: {
      title: `${region.name} — Atlas of Today's World`,
      description: region.summary.slice(0, 180),
      url: absoluteUrl(`/region/${region.slug}`),
    },
    other: geoMeta({
      lat: region.center[1],
      lon: region.center[0],
      placename: region.name,
    }),
  };
}

/**
 * Portrét regionu. Krátká verze zanikla – zadání chce jeden úplný portrét bez
 * mezikroku, takže `/region/[slug]/full` jen přesměrovává (viz next.config.ts).
 */
export default async function RegionPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  const atlas = await getAtlas(await localeFrom(params));
  const region = atlas.regionBySlug.get(slug);
  if (!region) notFound();

  const countries = countriesOf(atlas, region.countries);
  const [entries, encyclopedia, upcoming, dossier] = await Promise.all([
    getEntries(),
    getEncyclopediaEntries(),
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
          stats={groupStats(countries, atlas.indicatorById)}
        />
      </ContentRail>

      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Place",
            "@id": absoluteUrl(`/region/${region.slug}#region`),
            name: region.name,
            description: region.summary,
            url: absoluteUrl(`/region/${region.slug}`),
            image: region.hero ?? undefined,
            hasMap: absoluteUrl(`/region/${region.slug}`),
            geo: geoCoordinates(region.center[1], region.center[0]),
            containsPlace: countries.map((country) => ({
              "@type": "Country",
              name: country.name,
              url: absoluteUrl(`/country/${country.slug}`),
            })),
            subjectOf: newsItems.map((item) => ({
              "@type": "Article",
              headline: item.title,
              url: absoluteUrl(`/news/${item.slug}`),
            })),
          },
          ...(dossier.faq?.length
            ? [
                {
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  mainEntity: dossier.faq.map((item) => ({
                    "@type": "Question",
                    name: item.question,
                    acceptedAnswer: { "@type": "Answer", text: item.answer },
                  })),
                },
              ]
            : []),
          breadcrumbJsonLd([
            { name: "Atlas of Today's World", path: "/" },
            { name: region.name, path: `/region/${region.slug}` },
          ]),
        ]}
      />
    </>
  );
}
