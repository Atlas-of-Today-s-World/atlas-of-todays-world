import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContentRail from "@/components/ContentRail";
import CountryCard from "@/components/CountryCard";
import MapFocus from "@/components/map/MapFocus";
import { countryBySlug, formatPopulation, indexableCountries, type Country } from "@/lib/countries";
import { countryProfile, newsOfCountry } from "@/lib/content";
import { absoluteUrl, alternates, breadcrumbJsonLd, geoCoordinates, geoMeta } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { SafeHtml } from "@/components/atlas/SafeHtml";

export const dynamicParams = false;

export function generateStaticParams() {
  return indexableCountries().map((country) => ({ slug: country.slug }));
}

/** Popis pro země bez redakčního textu – složený z importovaných dat. */
function fallbackDescription(country: Country): string {
  const parts: string[] = [];
  parts.push(
    `${country.nameFormal ?? country.name} is a country in ${
      country.unSubregion ?? country.continent ?? "the world"
    }, covered by the Atlas as part of ${country.region?.name ?? "the world"}.`,
  );
  if (country.population) {
    parts.push(`It is home to about ${formatPopulation(country.population)} people.`);
  }
  const hdi = country.stats.find((stat) => stat.id === "hdi");
  if (hdi?.rank) {
    parts.push(
      `Its Human Development Index of ${hdi.value} ranks it ${hdi.rank} of ${hdi.rankOf} countries (${hdi.year}).`,
    );
  }
  const regime = country.stats.find((stat) => stat.id === "political-regime");
  if (regime) {
    parts.push(`Its political system is classified as ${regime.value.toLowerCase()}.`);
  }
  return parts.join(" ");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const country = countryBySlug(slug);
  if (!country) return {};

  const profile = await countryProfile(slug);
  const description = profile?.summary || fallbackDescription(country);

  return {
    title: `${country.name} — country profile`,
    description: description.slice(0, 180),
    alternates: alternates(`/country/${country.slug}`),
    keywords: [
      country.name,
      country.nameFormal ?? country.name,
      `${country.name} profile`,
      `${country.name} human development index`,
      `${country.name} political system`,
      country.region?.name ?? "",
    ].filter(Boolean),
    openGraph: {
      type: "profile",
      title: `${country.name} — Atlas of Today's World`,
      description: description.slice(0, 180),
      url: absoluteUrl(`/country/${country.slug}`),
      images: country.region ? [country.region.hero] : undefined,
    },
    other: geoMeta({
      lat: country.labelLat,
      lon: country.labelLon,
      placename: country.name,
      regionCode: country.iso2,
    }),
  };
}

export default async function CountryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const country = countryBySlug(slug);
  if (!country) notFound();

  const [profile, newsItems] = await Promise.all([
    countryProfile(slug),
    newsOfCountry(country.iso3),
  ]);

  const description = profile?.summary || fallbackDescription(country);
  const region = country.region;

  return (
    <>
      <MapFocus
        bbox={country.bbox}
        center={
          country.labelLon !== null && country.labelLat !== null
            ? [country.labelLon, country.labelLat]
            : (region?.center ?? null)
        }
        zoom={3.2}
        activeIso3={country.iso3}
        regionCountries={region?.countries ?? []}
        regionStroke={region?.stroke ?? null}
      />

      <ContentRail>
        <CountryCard
          country={country}
          newsItems={newsItems}
          description={description}
          profile={profile}
        />
        {profile?.html ? <SafeHtml className="prose-atlas px-6 pb-10" html={profile.html} /> : null}
      </ContentRail>

      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Country",
            "@id": absoluteUrl(`/country/${country.slug}#country`),
            name: country.name,
            alternateName: country.nameFormal ?? undefined,
            description,
            url: absoluteUrl(`/country/${country.slug}`),
            identifier: [
              { "@type": "PropertyValue", propertyID: "ISO 3166-1 alpha-3", value: country.iso3 },
              ...(country.iso2
                ? [
                    {
                      "@type": "PropertyValue",
                      propertyID: "ISO 3166-1 alpha-2",
                      value: country.iso2,
                    },
                  ]
                : []),
            ],
            geo: geoCoordinates(country.labelLat, country.labelLon),
            hasMap: absoluteUrl(`/country/${country.slug}`),
            containedInPlace: region
              ? {
                  "@type": "Place",
                  name: region.name,
                  url: absoluteUrl(`/region/${region.slug}`),
                }
              : undefined,
            // Ukazatele jako strojově čitelné hodnoty i se zdrojem a rokem.
            additionalProperty: country.stats.map((stat) => ({
              "@type": "PropertyValue",
              name: stat.label,
              value: stat.raw,
              unitText: stat.value.replace(/^[\d.,\s]+/, "").trim() || undefined,
              valueReference: `${stat.source} (${stat.year})`,
              url: stat.sourceUrl,
            })),
            subjectOf: newsItems.map((item) => ({
              "@type": "Article",
              headline: item.title,
              url: absoluteUrl(`/news/${item.slug}`),
            })),
          },
          breadcrumbJsonLd([
            { name: "Atlas of Today's World", path: "/" },
            ...(region ? [{ name: region.name, path: `/region/${region.slug}` }] : []),
            { name: country.name, path: `/country/${country.slug}` },
          ]),
        ]}
      />
    </>
  );
}
