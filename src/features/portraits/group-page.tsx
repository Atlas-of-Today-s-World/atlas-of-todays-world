import { getSiteSettings } from "@/features/site/queries";
import type { Metadata } from "next";
import ContentRail from "@/components/ContentRail";
import { JsonLd } from "@/components/JsonLd";
import MapFocus from "@/components/map/MapFocus";
import MapModeSetter from "@/components/map/MapModeSetter";
import Portrait, { newsCards, type PortraitSubject } from "@/components/portrait/Portrait";
import { routes } from "@/config/routes";
import {
  entriesOfIssue,
  entriesOfRegion,
  getEncyclopediaEntries,
  getEntries,
  getPlannedEntries,
  thematicEntries,
} from "@/features/entries/queries";
import { countriesOf } from "@/features/geography/model";
import { getAtlas, getIndicators } from "@/features/geography/queries";
import type { Atlas, GlobalIssue, Region } from "@/features/geography/types";
import { getRequestLocale, localeFrom } from "@/features/i18n/request";
import { redirectOrNotFound } from "@/features/redirects/queries";
import { relatedTopics } from "@/features/topics/related";
import { CARD_INDICATORS, groupStats, population } from "@/lib/region-stats";
import { geoMeta } from "@/lib/seo";
import {
  breadcrumbNode,
  faqNode,
  graph,
  homeCrumb,
  groupPlaceNode,
  ids,
  pageUrl,
  webPageNode,
} from "@/lib/seo/jsonld";
import { pageMetadata, pageTitle } from "@/lib/seo/metadata";
import { getPortrait } from "./queries";

/**
 * The portrait page of a group of countries: an Atlas region (`/region/[slug]`)
 * or an editorial global issue / custom region (`/global-issue/[slug]`). Both
 * show the same `Portrait` (ARCHITEKTURA 15, "same data = same component"), so
 * the two routes share their static params, metadata and page here and stay
 * thin wrappers. Route segment config (`dynamicParams`) stays in each route
 * file, where Next reads it.
 */
type GroupKind = "region" | "issue";

/** The group with its kind, so a branch on `kind` narrows `group`. */
type Located = { kind: "region"; group: Region } | { kind: "issue"; group: GlobalIssue };

type Params = Promise<{ locale: string; slug: string }>;

/** Where an article belongs (the shape the entry filters take). */
type Placed = Parameters<typeof entriesOfIssue>[0][number];

const pathOf = (kind: GroupKind, slug: string) =>
  kind === "region" ? routes.region(slug) : routes.issue(slug);

function locate(atlas: Atlas, kind: GroupKind, slug: string): Located | undefined {
  if (kind === "region") {
    const group = atlas.regionBySlug.get(slug);
    return group && { kind, group };
  }
  const group = atlas.issueBySlug.get(slug);
  return group && { kind, group };
}

/** `generateStaticParams` of the route: every region, or every global issue. */
export function groupStaticParams(kind: GroupKind) {
  return async function generateStaticParams() {
    const { regions, issues } = await getAtlas();
    return (kind === "region" ? regions : issues).map((group) => ({ slug: group.slug }));
  };
}

/** `generateMetadata` of the route. */
export function groupMetadata(kind: GroupKind) {
  return async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { slug } = await params;
    const locale = await localeFrom(params);
    const located = locate(await getAtlas(locale), kind, slug);
    if (!located) return {};
    const { group } = located;
    return pageMetadata({
      locale,
      path: pathOf(kind, group.slug),
      // An issue's subtitle only when it fits next to the name (≤ 60 characters with the brand).
      title: located.kind === "issue" ? pageTitle(group.name, located.group.subtitle) : group.name,
      description: group.summary,
      ownImage: true,
      other: geoMeta({ lat: group.center[1], lon: group.center[0], placename: group.name }),
    });
  };
}

/** The page: the globe turns to the group, the portrait opens in the wide rail. */
export function groupPortraitPage(kind: GroupKind) {
  return async function GroupPortraitPage({ params }: { params: Params }) {
    const { slug } = await params;
    const locale = await localeFrom(params);
    const atlas = await getAtlas(locale);
    const site = await getSiteSettings();
    const located = locate(atlas, kind, slug);
    // Unknown URL: redirect (changed slug), otherwise 404. The route's layout
    // answers it first; this only narrows the type.
    if (!located) return redirectOrNotFound(pathOf(kind, slug), locale);
    const { group } = located;
    const path = pathOf(kind, group.slug);

    // A region's articles are those filed under it; an issue's also those
    // touching any of its countries.
    const ofGroup = <T extends Placed>(entries: T[]) =>
      kind === "region"
        ? entriesOfRegion(entries, group.slug)
        : entriesOfIssue(entries, group.slug, group.countries);

    const countries = countriesOf(atlas, group.countries);
    const [entries, encyclopedia, upcoming, dossier, topics, indicators] = await Promise.all([
      getEntries(),
      getEncyclopediaEntries(),
      getPlannedEntries(),
      getPortrait(kind, group.slug),
      relatedTopics(atlas, kind, group.slug),
      getIndicators(CARD_INDICATORS),
    ]);
    const newsItems = ofGroup(entries);
    const members = countries.map(({ slug, name }) => ({ slug, name }));

    const subject: PortraitSubject =
      located.kind === "region"
        ? {
            kind: "region",
            name: group.name,
            summary: group.summary,
            hero: group.hero,
            countries: members,
            population: population(countries),
            showMetrics: located.group.showMetrics,
            status: group.contentStatus,
          }
        : {
            kind: "issue",
            groupKind: located.group.kind,
            status: group.contentStatus,
            name: group.name,
            subtitle: located.group.subtitle,
            summary: group.summary,
            accent: group.fill,
            hero: group.hero,
            countries: members,
            population: population(countries),
          };

    const place = groupPlaceNode({
      kind,
      slug: group.slug,
      name: group.name,
      alternateName: located.kind === "issue" ? located.group.subtitle : undefined,
      description: group.summary,
      locale,
      center: group.center,
      image: group.hero,
      countries,
    });

    return (
      <>
        <MapFocus
          center={group.center}
          zoom={group.zoom}
          regionCountries={group.countries}
          regionStroke={group.stroke}
        />
        {kind === "issue" ? <MapModeSetter mode="issue" /> : null}

        <ContentRail wide>
          <Portrait
            topics={topics}
            subject={subject}
            news={newsCards(newsItems)}
            entries={thematicEntries(ofGroup(encyclopedia), ofGroup(upcoming))}
            dossier={dossier}
            stats={groupStats(countries, indicators, getRequestLocale())}
          />
        </ContentRail>

        <JsonLd
          data={graph(
            webPageNode({
              url: pageUrl(path, locale),
              name:
                located.kind === "issue" ? `${group.name} — ${located.group.subtitle}` : group.name,
              description: group.summary,
              locale,
              about: kind === "region" ? ids.region(group.slug) : ids.issue(group.slug),
              image: group.hero,
              breadcrumb: breadcrumbNode([homeCrumb(site), { name: group.name, path }], locale),
            }),
            // A region lists its news as what the place is the subject of.
            kind === "region"
              ? {
                  ...place,
                  subjectOf: newsItems.map((item) => ({
                    "@type": "NewsArticle",
                    headline: item.title,
                    url: pageUrl(routes.news(item.slug), locale),
                  })),
                }
              : place,
            faqNode(pageUrl(path, locale), dossier.faq ?? []),
          )}
        />
      </>
    );
  };
}
