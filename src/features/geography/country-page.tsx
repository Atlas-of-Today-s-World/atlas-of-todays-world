import { getSiteSettings } from "@/features/site/queries";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContentRail from "@/components/ContentRail";
import CountryCard from "@/components/CountryCard";
import RegionFocus from "@/components/map/RegionFocus";
import { entriesOfCountry, getEntries } from "@/features/entries/queries";
import { getAtlas, getCountryProfileHtml, getCountryStats } from "@/features/geography/queries";
import { format, type Messages } from "@/lib/i18n/messages";
import { getRequestLocale, getT, localeFrom } from "@/lib/i18n/request";
import type { Country, CountryStat } from "@/features/geography/types";
import { formatPopulation } from "@/lib/format";
import { geoMeta } from "@/lib/seo";
import { pageMetadata, pageTitle } from "@/features/seo/metadata";
import {
  breadcrumbNode,
  countryNode,
  graph,
  ids,
  pageUrl,
  webPageNode,
} from "@/features/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { SafeHtml } from "@/components/atlas/SafeHtml";
import { RegionalProfile } from "@/components/portrait/RegionalProfile";
import { ProfileSections } from "@/components/portrait/Portrait";
import { getCountryTimeline } from "@/features/timelines/queries";
import { getPortrait } from "@/features/portraits/queries";
import { relatedTopics } from "@/features/topics/related";
import { routes } from "@/config/routes";

/**
 * A country's page in two views (2026-10-16): the wide preview in the side
 * panel (`/country/<slug>`, what a click on the globe opens) and the same
 * content full width (`/country/<slug>/full-page`, the panel's "Full page view").
 * Both routes are thin wrappers around this module; their route segment
 * config (`dynamicParams`) stays in each route file, where Next reads it.
 */
type CountryParams = Promise<{ locale: string; slug: string }>;

export async function countryStaticParams() {
  const { countries } = await getAtlas();
  return countries.map((country) => ({ slug: country.slug }));
}

/** Description for countries without editorial text – composed from imported data. */
function fallbackDescription(
  country: Country,
  stats: CountryStat[],
  t: Messages["countryText"],
): string {
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
  const hdi = stats.find((stat) => stat.id === "hdi");
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
  const regime = stats.find((stat) => stat.id === "political-regime");
  if (regime) parts.push(format(t.regime, { regime: regime.value.toLowerCase() }));
  return parts.join(" ");
}

/** Metadata of both views; the full view's canonical is the preview's URL (same content). */
export async function countryMetadata({ params }: { params: CountryParams }): Promise<Metadata> {
  const { slug } = await params;
  const locale = await localeFrom(params);
  const country = (await getAtlas(locale)).countryBySlug.get(slug);
  if (!country) return {};
  const t = await getT();

  const description =
    country.profile.summary ||
    fallbackDescription(country, await getCountryStats(country.iso3, locale), t.countryText);

  return pageMetadata({
    locale,
    path: routes.country(country.slug),
    title: pageTitle(format(t.countryCard.title, { name: country.name })),
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

export async function CountryPage({
  params,
  view,
}: {
  params: CountryParams;
  view: "rail" | "full";
}) {
  const { slug } = await params;
  const locale = await localeFrom(params);
  const atlas = await getAtlas(locale);
  const site = await getSiteSettings();
  const country = atlas.countryBySlug.get(slug);
  if (!country) notFound();

  const region = country.region;
  // The region's own record (photo, summary) for its profile under the country.
  const regionData = region ? atlas.regionBySlug.get(region.slug) : undefined;
  const [topics, entries, dossier, profileHtml, stats, timeline] = await Promise.all([
    relatedTopics(atlas, "country", country.iso3),
    getEntries(),
    regionData ? getPortrait("region", regionData.slug) : null,
    getCountryProfileHtml(country.iso3),
    getCountryStats(country.iso3, locale),
    getCountryTimeline(country.iso3),
  ]);
  const newsItems = entriesOfCountry(entries, country.iso3);
  const profile = country.profile;
  const t = await getT();
  const description = profile.summary || fallbackDescription(country, stats, t.countryText);

  const content = (
    <>
      <CountryCard
        country={country}
        stats={stats}
        newsItems={newsItems}
        description={description}
        profile={profile}
        topics={topics}
      />
      {profileHtml ? <SafeHtml className="prose-atlas px-6 pb-10" html={profileHtml} /> : null}
      {/* Owner's request of 2026-10-16 (call with the Atlas team): after the
          country's data straight to its region's profile — the country's
          context — then the country's own run in the site-wide order (Admin →
          Portrait layout): its timeline and its topics by theme. The topics
          already hold the region's, which is why the region's profile above
          leaves them out. With no topic, the invitation at the top of the card
          is enough. */}
      {regionData && dossier ? (
        <RegionalProfile country={country.name} region={regionData} dossier={dossier} />
      ) : null}
      <ProfileSections
        dossier={
          timeline
            ? {
                timeline: timeline.items,
                timelineTitle: timeline.title,
                timelineSubtitle: timeline.subtitle,
              }
            : {}
        }
        topics={topics.items.length ? topics : undefined}
        place={country.name}
        timelineId="country-timeline"
      />
    </>
  );

  return (
    <>
      <RegionFocus
        region={region}
        bbox={country.bbox}
        center={
          country.labelLon !== null && country.labelLat !== null
            ? [country.labelLon, country.labelLat]
            : (region?.center ?? null)
        }
        zoom={3.2}
        activeIso3={country.iso3}
      />

      {view === "rail" ? (
        <ContentRail wide fullPage={routes.countryFull(country.slug)}>
          {content}
        </ContentRail>
      ) : (
        <article className="mx-auto max-w-5xl pt-4">{content}</article>
      )}

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
              site,
              [
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
              stats,
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
