import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContentRail from "@/components/ContentRail";
import RegionPortrait from "@/components/RegionPortrait";
import MapFocus from "@/components/map/MapFocus";
import { REGIONS, REGION_BY_SLUG } from "@/data/regions";
import { countriesOfRegion } from "@/lib/countries";
import { newsOfRegion, regionDossier } from "@/lib/content";
import { population, regionStats } from "@/lib/region-stats";
import { absoluteUrl, alternates, breadcrumbJsonLd, geoCoordinates, geoMeta } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export const dynamicParams = false;

export function generateStaticParams() {
  return REGIONS.map((region) => ({ slug: region.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const region = REGION_BY_SLUG[slug];
  if (!region) return {};
  return {
    title: region.name,
    description: region.summary.slice(0, 180),
    alternates: alternates(`/region/${region.slug}`),
    openGraph: {
      title: `${region.name} — Atlas of Today's World`,
      description: region.summary.slice(0, 180),
      url: absoluteUrl(`/region/${region.slug}`),
      images: region.hero ? [region.hero] : undefined,
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
export default async function RegionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const region = REGION_BY_SLUG[slug];
  if (!region) notFound();

  const countries = countriesOfRegion(region);
  const [newsItems, dossier] = await Promise.all([
    newsOfRegion(region.slug),
    regionDossier(region.slug),
  ]);

  return (
    <>
      <MapFocus
        center={region.center}
        zoom={region.zoom}
        regionCountries={region.countries}
        regionStroke={region.stroke}
      />
      <ContentRail wide>
        <RegionPortrait
          region={region}
          newsItems={newsItems}
          dossier={dossier}
          stats={regionStats(region)}
          countryCount={countries.length}
          population={population(countries)}
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
            image: region.hero,
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
