import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContentRail from "@/components/ContentRail";
import RegionPanel from "@/components/RegionPanel";
import MapFocus from "@/components/map/MapFocus";
import { REGIONS, REGION_BY_SLUG } from "@/data/regions";
import { countriesOfRegion } from "@/lib/countries";
import { entriesOfRegion } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

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
    alternates: { canonical: `/region/${region.slug}` },
    openGraph: {
      title: `${region.name} — Atlas of Today's World`,
      description: region.summary.slice(0, 180),
      images: [region.hero],
      url: `${SITE_URL}/region/${region.slug}`,
    },
  };
}

export default async function RegionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const region = REGION_BY_SLUG[slug];
  if (!region) notFound();

  const countries = countriesOfRegion(region);
  const entries = await entriesOfRegion(region.slug);

  return (
    <>
      <MapFocus
        center={region.center}
        zoom={region.zoom}
        regionCountries={region.countries}
        regionStroke={region.stroke}
      />
      <ContentRail>
        <RegionPanel region={region} countries={countries} entries={entries} />
      </ContentRail>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Place",
            name: region.name,
            description: region.summary,
            url: `${SITE_URL}/region/${region.slug}`,
            containsPlace: countries.map((country) => ({
              "@type": "Country",
              name: country.name,
              url: `${SITE_URL}/country/${country.slug}`,
            })),
          }),
        }}
      />
    </>
  );
}
