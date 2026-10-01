import type { Metadata } from "next";
import { redirectOrNotFound } from "@/features/redirects/queries";
import ContentRail from "@/components/ContentRail";
import MapFocus from "@/components/map/MapFocus";
import MapModeSetter from "@/components/map/MapModeSetter";
import Portrait, { newsCards } from "@/components/portrait/Portrait";
import { groupStats, population } from "@/lib/region-stats";
import {
  entriesOfIssue,
  getEncyclopediaEntries,
  getEntries,
  getPlannedEntries,
  thematicEntries,
} from "@/features/entries/queries";
import { countriesOf } from "@/features/geography/model";
import { getAtlas } from "@/features/geography/queries";
import { getRequestLocale, localeFrom } from "@/features/i18n/request";
import { getPortrait } from "@/features/portraits/queries";
import { absoluteUrl, alternates, breadcrumbJsonLd, geoCoordinates, geoMeta } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

// Global Issues are created in the admin, so the route must also handle a slug
// that didn't exist at build time.
export const dynamicParams = true;

export async function generateStaticParams() {
  const { issues } = await getAtlas();
  return issues.map((issue) => ({ slug: issue.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const region = (await getAtlas(await localeFrom(params))).issueBySlug.get(slug);
  if (!region) return {};

  return {
    title: `${region.name} — ${region.subtitle}`,
    description: region.summary.slice(0, 180),
    alternates: alternates(`/global-issue/${region.slug}`, await localeFrom(params)),
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

export default async function GlobalIssuePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  const atlas = await getAtlas(await localeFrom(params));
  const region = atlas.issueBySlug.get(slug);
  // Unknown URL: redirect (changed slug), otherwise 404.
  if (!region) return redirectOrNotFound(`/global-issue/${slug}`, await localeFrom(params));

  const countries = countriesOf(atlas, region.countries);
  const [entries, encyclopedia, upcoming, dossier] = await Promise.all([
    getEntries(getRequestLocale()),
    getEncyclopediaEntries(getRequestLocale()),
    getPlannedEntries(),
    getPortrait("issue", region.slug),
  ]);
  const related = entriesOfIssue(entries, region.slug, region.countries);

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
            groupKind: region.kind,
            name: region.name,
            subtitle: region.subtitle,
            summary: region.summary,
            accent: region.fill,
            hero: region.hero,
            countries: countries.map(({ slug, name }) => ({ slug, name })),
            population: population(countries),
          }}
          news={newsCards(related)}
          entries={thematicEntries(
            entriesOfIssue(encyclopedia, region.slug, region.countries),
            entriesOfIssue(upcoming, region.slug, region.countries),
          )}
          dossier={dossier}
          stats={groupStats(countries, atlas.indicatorById, getRequestLocale())}
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
