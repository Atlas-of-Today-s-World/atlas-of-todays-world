import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContentRail from "@/components/ContentRail";
import CountryCard from "@/components/CountryCard";
import MapFocus from "@/components/map/MapFocus";
import {
  entriesOfCountry,
  entriesOfRegion,
  getEntries,
  getPlannedEntries,
  thematicEntries,
} from "@/features/entries/queries";
import { getAtlas } from "@/features/geography/queries";
import { format, type Messages } from "@/features/i18n/messages";
import { getRequestLocale, getT, localeFrom } from "@/features/i18n/request";
import type { Country } from "@/features/geography/types";
import { formatPopulation } from "@/lib/format";
import { geoMeta } from "@/lib/seo";
import { pageMetadata, pageTitle } from "@/lib/seo/metadata";
import { breadcrumbNode, countryNode, graph, ids, pageUrl, webPageNode } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { SafeHtml } from "@/components/atlas/SafeHtml";
import { RelatedTopics } from "@/components/topics/RelatedTopics";
import { RegionalProfile } from "@/components/portrait/RegionalProfile";
import { getPortrait } from "@/features/portraits/queries";
import { relatedTopics } from "@/features/topics/related";
import { routes } from "@/config/routes";

// true: with false, Next returns 404 after revalidateTag (an admin write) even for
// existing pages (NoFallbackError). An unknown slug ends up in notFound().
export const dynamicParams = true;

export async function generateStaticParams() {
  const { countries } = await getAtlas();
  return countries.map((country) => ({ slug: country.slug }));
}

/** Description for countries without editorial text – composed from imported data. */
function fallbackDescription(country: Country, t: Messages["countryText"]): string {
  const parts: string[] = [
    format(t.intro, {
      name: country.nameFormal ?? country.name,
      area: country.unSubregion ?? country.continent ?? t.world,
      region: country.region?.name ?? t.world,
    }),
  ];
  if (country.population) {
    parts.push(
      format(t.population, {
        population: formatPopulation(country.population, getRequestLocale()),
      }),
    );
  }
  const hdi = country.stats.find((stat) => stat.id === "hdi");
  if (hdi?.rank) {
    parts.push(
      format(t.hdi, {
        value: String(hdi.value),
        rank: String(hdi.rank),
        of: String(hdi.rankOf),
        year: String(hdi.year),
      }),
    );
  }
  const regime = country.stats.find((stat) => stat.id === "political-regime");
  if (regime) parts.push(format(t.regime, { regime: regime.value.toLowerCase() }));
  return parts.join(" ");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await localeFrom(params);
  const country = (await getAtlas(locale)).countryBySlug.get(slug);
  if (!country) return {};

  const description = country.profile.summary || fallbackDescription(country, getT().countryText);

  return pageMetadata({
    locale,
    path: routes.country(country.slug),
    title: pageTitle(format(getT().countryCard.title, { name: country.name })),
    description,
    type: "profile",
    ownImage: true,
    keywords: [
      country.name,
      country.nameFormal ?? country.name,
      `${country.name} profile`,
      `${country.name} human development index`,
      `${country.name} political system`,
      country.region?.name ?? "",
    ].filter(Boolean),
    other: geoMeta({
      lat: country.labelLat,
      lon: country.labelLon,
      placename: country.name,
      regionCode: country.iso2,
    }),
  });
}

export default async function CountryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  const locale = await localeFrom(params);
  const atlas = await getAtlas(locale);
  const country = atlas.countryBySlug.get(slug);
  if (!country) notFound();

  const region = country.region;
  // The region's own record (photo, summary) for its profile under the country.
  const regionData = region ? atlas.regionBySlug.get(region.slug) : undefined;
  const [topics, entries, dossier, upcoming] = await Promise.all([
    relatedTopics(atlas, "country", country.iso3),
    getEntries(),
    regionData ? getPortrait("region", regionData.slug) : null,
    getPlannedEntries(),
  ]);
  const newsItems = entriesOfCountry(entries, country.iso3);
  const profile = country.profile;
  const description = profile.summary || fallbackDescription(country, getT().countryText);

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
          topics={topics}
        />
        {profile.html ? <SafeHtml className="prose-atlas px-6 pb-10" html={profile.html} /> : null}
        {regionData && dossier ? (
          // Topics in the profile are the country's (own, region's, groups') by theme,
          // next to what the region has planned.
          <RegionalProfile
            country={country.name}
            region={regionData}
            dossier={dossier}
            entries={thematicEntries(topics.items, entriesOfRegion(upcoming, regionData.slug))}
          />
        ) : (
          <RelatedTopics
            items={topics.items}
            href={topics.href}
            place={country.name}
            className="mt-0 px-6 pb-10"
          />
        )}
      </ContentRail>

      <JsonLd
        data={graph(
          webPageNode({
            url: pageUrl(routes.country(country.slug), locale),
            name: country.name,
            description,
            locale,
            type: "ItemPage",
            about: ids.country(country.slug),
            breadcrumb: breadcrumbNode(
              [
                { name: "Atlas of Today's World", path: "/" },
                ...(region ? [{ name: region.name, path: routes.region(region.slug) }] : []),
                { name: country.name, path: routes.country(country.slug) },
              ],
              locale,
            ),
          }),
          {
            ...countryNode({
              slug: country.slug,
              iso3: country.iso3,
              iso2: country.iso2,
              name: country.name,
              nameFormal: country.nameFormal,
              description,
              lat: country.labelLat,
              lon: country.labelLon,
              locale,
              region,
              population: country.population,
              stats: country.stats,
            }),
            subjectOf: newsItems.map((item) => ({
              "@type": "NewsArticle",
              headline: item.title,
              url: pageUrl(routes.news(item.slug), locale),
            })),
          },
        )}
      />
    </>
  );
}
