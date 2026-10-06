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
import { relatedTopics } from "@/features/topics/related";
import { getRequestLocale, localeFrom } from "@/features/i18n/request";
import { getPortrait } from "@/features/portraits/queries";
import { geoMeta } from "@/lib/seo";
import { pageMetadata, pageTitle } from "@/lib/seo/metadata";
import {
  breadcrumbNode,
  faqNode,
  graph,
  groupPlaceNode,
  ids,
  pageUrl,
  webPageNode,
} from "@/lib/seo/jsonld";
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
  const locale = await localeFrom(params);
  const region = (await getAtlas(locale)).issueBySlug.get(slug);
  if (!region) return {};

  return pageMetadata({
    locale,
    path: `/global-issue/${region.slug}`,
    // The subtitle only when it fits next to the name (≤ 60 characters with the brand).
    title: pageTitle(region.name, region.subtitle),
    description: region.summary,
    ownImage: true,
    other: geoMeta({ lat: region.center[1], lon: region.center[0], placename: region.name }),
  });
}

export default async function GlobalIssuePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  const locale = await localeFrom(params);
  const atlas = await getAtlas(locale);
  const region = atlas.issueBySlug.get(slug);
  // Unknown URL: redirect (changed slug), otherwise 404.
  if (!region) return redirectOrNotFound(`/global-issue/${slug}`, locale);

  const countries = countriesOf(atlas, region.countries);
  const [entries, encyclopedia, upcoming, dossier, topics] = await Promise.all([
    getEntries(getRequestLocale()),
    getEncyclopediaEntries(getRequestLocale()),
    getPlannedEntries(),
    getPortrait("issue", region.slug),
    relatedTopics(atlas, locale, "issue", region.slug),
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
          topics={topics}
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
        data={graph(
          webPageNode({
            url: pageUrl(`/global-issue/${region.slug}`, locale),
            name: `${region.name} — ${region.subtitle}`,
            description: region.summary,
            locale,
            about: ids.issue(region.slug),
            image: region.hero,
            breadcrumb: breadcrumbNode(
              [
                { name: "Atlas of Today's World", path: "/" },
                { name: region.name, path: `/global-issue/${region.slug}` },
              ],
              locale,
            ),
          }),
          groupPlaceNode({
            kind: "issue",
            slug: region.slug,
            name: region.name,
            alternateName: region.subtitle,
            description: region.summary,
            locale,
            center: region.center,
            image: region.hero,
            countries,
          }),
          faqNode(pageUrl(`/global-issue/${region.slug}`, locale), dossier.faq ?? []),
        )}
      />
    </>
  );
}
