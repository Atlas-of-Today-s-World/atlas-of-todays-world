import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContentRail from "@/components/ContentRail";
import MapFocus from "@/components/map/MapFocus";
import MapModeSetter from "@/components/map/MapModeSetter";
import Portrait, { newsCards } from "@/components/portrait/Portrait";
import { groupStats, population } from "@/lib/region-stats";
import { countryByIso3 } from "@/lib/countries";
import { allNews } from "@/lib/content";
import { allGlobalIssues, globalIssueBySlug } from "@/lib/global-issues";
import { absoluteUrl, alternates, breadcrumbJsonLd, geoCoordinates, geoMeta } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

// Global Issues vznikají v administraci, takže routa musí umět i slug,
// který v době buildu neexistoval.
export const dynamicParams = true;

export async function generateStaticParams() {
  const regions = await allGlobalIssues();
  return regions.map((region) => ({ slug: region.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const region = await globalIssueBySlug(slug);
  if (!region) return {};

  return {
    title: `${region.name} — ${region.subtitle}`,
    description: region.summary.slice(0, 180),
    alternates: alternates(`/global-issue/${region.slug}`),
    openGraph: {
      title: `${region.name} — Atlas of Today's World`,
      description: region.summary.slice(0, 180),
      url: absoluteUrl(`/global-issue/${region.slug}`),
    },
    other: geoMeta({
      lat: region.center[1],
      lon: region.center[0],
      placename: region.name,
    }),
  };
}

export default async function GlobalIssuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const region = await globalIssueBySlug(slug);
  if (!region) notFound();

  const countries = region.countries
    .map((iso3) => countryByIso3(iso3))
    .filter((country): country is NonNullable<typeof country> => country !== null)
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

  // Napřed novinky přiřazené přímo k celku (pole `issue`), za nimi ty, které
  // se trefily některou ze zemí celku. Bez duplicit.
  const members = new Set(region.countries);
  const news = await allNews();
  const tagged = news.filter((item) => item.issue === region.slug);
  const related = [
    ...tagged,
    ...news.filter(
      (item) =>
        item.issue !== region.slug && (item.countries ?? []).some((iso3) => members.has(iso3)),
    ),
  ];

  return (
    <>
      <MapFocus
        center={region.center}
        zoom={region.zoom}
        regionCountries={region.countries}
        regionStroke={region.stroke}
      />
      <MapModeSetter mode="issue" />

      <ContentRail wide>
        <Portrait
          subject={{
            kind: "issue",
            name: region.name,
            subtitle: region.subtitle,
            summary: region.summary,
            accent: region.fill,
            countries: countries.map(({ slug, name }) => ({ slug, name })),
            population: population(countries),
          }}
          news={newsCards(related)}
          dossier={{}}
          stats={groupStats(countries)}
        />
      </ContentRail>

      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Place",
            name: region.name,
            alternateName: region.subtitle,
            description: region.summary,
            url: absoluteUrl(`/global-issue/${region.slug}`),
            geo: geoCoordinates(region.center[1], region.center[0]),
            containsPlace: countries.map((country) => ({
              "@type": "Country",
              name: country.name,
              url: absoluteUrl(`/country/${country.slug}`),
            })),
          },
          breadcrumbJsonLd([
            { name: "Atlas of Today's World", path: "/" },
            { name: region.name, path: `/global-issue/${region.slug}` },
          ]),
        ]}
      />
    </>
  );
}
