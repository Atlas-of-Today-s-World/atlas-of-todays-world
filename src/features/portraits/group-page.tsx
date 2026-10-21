import { getSiteSettings } from "@/features/site/queries";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { routes } from "@/config/routes";
import { countriesOf } from "@/features/geography/model";
import { getAtlas, getIndicators } from "@/features/geography/queries";
import type { Atlas, GlobalIssue, Region } from "@/features/geography/types";
import { getMessagesFor, getRequestLocale, localeFrom } from "@/lib/i18n/request";
import { redirectOrNotFound } from "@/features/redirects/queries";
import { relatedTopics } from "@/features/topics/related";
import { CARD_INDICATORS, groupStats, population } from "@/features/geography/region-stats";
import { geoMeta } from "@/lib/seo";
import {
  breadcrumbNode,
  faqNode,
  graph,
  groupPlaceNode,
  ids,
  pageUrl,
  webPageNode,
} from "@/features/seo/jsonld";
import { pageMetadata, pageTitle } from "@/features/seo/metadata";
import { getPortrait } from "./queries";
import ContentRail from "@/components/ContentRail";
import MapModeSetter from "@/components/map/MapModeSetter";
import RegionFocus from "@/components/map/RegionFocus";
import Portrait from "@/components/portrait/Portrait";
import { IssueArticle } from "./components/IssueArticle";
import { RegionArticle } from "./components/RegionArticle";

/**
 * The portrait page of a group of countries: an Atlas region (`/region/[slug]`)
 * or an editorial global issue / custom region (`/global-issue/[slug]`). Both
 * show the same portrait sections (ARCHITEKTURA 15, "same data = same
 * component") — each on its own full-width page (`RegionArticle`,
 * `IssueArticle`) — so the two routes share their static
 * params, metadata, data and JSON-LD here and stay thin wrappers. Route segment config (`dynamicParams`) stays in each route
 * file, where Next reads it.
 */
type GroupKind = "region" | "issue";

/** Side panel over the map, or the whole article at `…/full-page`. */
type GroupView = "rail" | "full";

/** The group with its kind, so a branch on `kind` narrows `group`. */
type Located = { kind: "region"; group: Region } | { kind: "issue"; group: GlobalIssue };

type Params = Promise<{ locale: string; slug: string }>;

/** Where an article belongs (the shape the entry filters take). */

const pathOf = (kind: GroupKind, slug: string) =>
  kind === "region" ? routes.region(slug) : routes.issue(slug);

/**
 * The full article's address. It is the canonical one for both views: the rail
 * preview shows the same portrait shortened, so search engines are pointed at
 * the whole thing rather than asked to choose.
 */
const fullPathOf = (kind: GroupKind, slug: string) =>
  kind === "region" ? routes.regionFull(slug) : routes.issueFull(slug);

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
      // Canonical: the full article, from the preview too (see fullPathOf).
      path: fullPathOf(kind, group.slug),
      // An issue's subtitle only when it fits next to the name (≤ 60 characters with the brand).
      title: located.kind === "issue" ? pageTitle(group.name, located.group.subtitle) : group.name,
      description: group.summary,
      ownImage: true,
      other: geoMeta({ lat: group.center[1], lon: group.center[0], placename: group.name }),
    });
  };
}

/**
 * The page, in either of its two views (2026-10-16). `rail`: the globe turns
 * to the place and the portrait opens in the wide side panel (`Portrait`),
 * with "Full page view" at its top. `full`: the whole article at
 * `/<kind>/<slug>/full-page` (`RegionArticle`, `IssueArticle`), the globe
 * waiting in its corner window.
 */
export function groupPortraitPage(kind: GroupKind, view: GroupView = "rail") {
  return async function GroupPortraitPage({ params }: { params: Params }) {
    const { slug } = await params;
    const locale = await localeFrom(params);
    const atlas = await getAtlas(locale);
    const site = await getSiteSettings();
    const located = locate(atlas, kind, slug);
    // Unknown URL: redirect (changed slug), otherwise 404. The route's layout
    // answers it first; this only narrows the type.
    // The address actually visited, so a renamed slug redirects to the same view.
    if (!located) {
      return redirectOrNotFound(
        view === "full" ? fullPathOf(kind, slug) : pathOf(kind, slug),
        locale,
      );
    }
    const { group } = located;
    const path = fullPathOf(kind, group.slug);
    const fullPath = path;

    const countries = countriesOf(atlas, group.countries);
    const [dossier, topics, t, indicators] = await Promise.all([
      getPortrait(kind, group.slug),
      relatedTopics(atlas, kind, group.slug),
      getMessagesFor(locale),
      // Computed figures only for an issue: a region never shows averages (2026-10-07).
      kind === "issue" ? getIndicators(CARD_INDICATORS) : [],
    ]);
    const members = countries.map(({ slug, name }) => ({ slug, name }));

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

    // What an issue is the subject of: its entries (on its page as "Subtopics").
    const subjectOf =
      kind === "issue"
        ? topics.items.map((item) => ({
            "@type": "Article",
            headline: item.title,
            url: pageUrl(routes.entry(item.slug), locale),
          }))
        : [];

    return (
      <>
        {view === "rail" ? (
          // The preview: the globe turns to the place, the portrait opens beside it.
          <>
            <RegionFocus region={group} />
            {/* An issue lights its countries and greys the rest, also when its
                preview is opened from a link rather than from the switcher. */}
            {located.kind === "issue" ? <MapModeSetter mode="issue" /> : null}
            <ContentRail wide fullPage={fullPath}>
              <Portrait
                topics={topics}
                subject={{
                  name: group.name,
                  // Under the name: a region's tagline, an issue's subtitle.
                  subtitle:
                    located.kind === "region" ? located.group.tagline : located.group.subtitle,
                  summary: group.summary,
                  hero: group.hero,
                  heroCredit: group.heroCredit,
                  countries: members,
                  population: population(countries),
                  status: group.contentStatus,
                  issue: located.kind === "issue" && located.group.kind === "issue",
                }}
                dossier={dossier}
              />
            </ContentRail>
          </>
        ) : located.kind === "region" ? (
          <RegionArticle
            region={located.group}
            dossier={dossier}
            topics={topics}
            countries={members}
            population={population(countries)}
          />
        ) : (
          <IssueArticle
            issue={located.group}
            dossier={dossier}
            stats={groupStats(countries, indicators, getRequestLocale())}
            topics={topics}
            countries={members}
            population={population(countries)}
          />
        )}

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
              breadcrumb: breadcrumbNode(
                site,
                [
                  // An issue sits under the Global issues overview, as its page's trail shows.
                  ...(kind === "issue"
                    ? [{ name: t.globalIssues.title, path: routes.globalIssues }]
                    : []),
                  { name: group.name, path },
                ],
                locale,
              ),
            }),
            subjectOf.length ? { ...place, subjectOf } : place,
            faqNode(pageUrl(path, locale), dossier.faq ?? []),
          )}
        />
      </>
    );
  };
}
