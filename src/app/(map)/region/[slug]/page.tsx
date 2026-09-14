import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContentRail from "@/components/ContentRail";
import RegionPanel from "@/components/RegionPanel";
import MapFocus from "@/components/map/MapFocus";
import { REGIONS, REGION_BY_SLUG } from "@/data/regions";
import { countriesOfRegion } from "@/lib/countries";
import { entriesOfRegion } from "@/lib/content";
import {
  absoluteUrl,
  alternates,
  breadcrumbJsonLd,
  geoCoordinates,
  geoMeta,
  jsonLdHtml,
} from "@/lib/seo";

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
    keywords: [
      region.name,
      `${region.name} countries`,
      `${region.name} profile`,
      "world region",
    ],
    openGraph: {
      title: `${region.name} — Atlas of Today's World`,
      description: region.summary.slice(0, 180),
      images: [region.hero],
      url: absoluteUrl(`/region/${region.slug}`),
    },
    other: geoMeta({
      lat: region.center[1],
      lon: region.center[0],
      placename: region.name,
    }),
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
          __html: jsonLdHtml([
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
              subjectOf: entries.map((entry) => ({
                "@type": "Article",
                headline: entry.title,
                url: absoluteUrl(`/entry/${entry.slug}`),
              })),
            },
            breadcrumbJsonLd([
              { name: "Atlas of Today's World", path: "/" },
              { name: region.name, path: `/region/${region.slug}` },
            ]),
          ]),
        }}
      />
    </>
  );
}
