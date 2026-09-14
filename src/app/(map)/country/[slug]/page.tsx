import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContentRail from "@/components/ContentRail";
import CountryCard from "@/components/CountryCard";
import MapFocus from "@/components/map/MapFocus";
import {
  countryBySlug,
  formatPopulation,
  indexableCountries,
  type Country,
} from "@/lib/countries";
import { countryProfile, entriesOfCountry } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

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
    alternates: { canonical: `/country/${country.slug}` },
    openGraph: {
      title: `${country.name} — Atlas of Today's World`,
      description: description.slice(0, 180),
      url: `${SITE_URL}/country/${country.slug}`,
    },
  };
}

export default async function CountryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const country = countryBySlug(slug);
  if (!country) notFound();

  const [profile, entries] = await Promise.all([
    countryProfile(slug),
    entriesOfCountry(country.iso3),
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

      <ContentRail closeHref={region ? `/region/${region.slug}` : "/"}>
        <CountryCard country={country} entries={entries} description={description} />
        {profile?.html ? (
          <div
            className="prose-atlas px-6 pb-10"
            dangerouslySetInnerHTML={{ __html: profile.html }}
          />
        ) : null}
      </ContentRail>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Country",
            name: country.name,
            alternateName: country.nameFormal ?? undefined,
            description,
            url: `${SITE_URL}/country/${country.slug}`,
            containedInPlace: region
              ? { "@type": "Place", name: region.name, url: `${SITE_URL}/region/${region.slug}` }
              : undefined,
          }),
        }}
      />
    </>
  );
}
