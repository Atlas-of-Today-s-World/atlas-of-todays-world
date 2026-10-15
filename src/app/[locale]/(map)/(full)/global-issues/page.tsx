import { getSiteSettings } from "@/features/site/queries";
import { preload } from "react-dom";
import { PHOTO_WIDTH, photoUrl } from "@/lib/images";
import { safeUrl } from "@/lib/security/urls";
import { JsonLd } from "@/components/JsonLd";
import { getAtlas } from "@/features/geography/queries";
import { getMessagesFor, localeFrom } from "@/lib/i18n/request";
import { IssuesBrowser } from "@/features/portraits/components/IssuesBrowser";
import { issueFilters } from "@/features/portraits/issue-index";
import { topicIndex } from "@/features/topics/related";
import { staticPageMetadata } from "@/features/seo/metadata";
import { collectionPageGraph } from "@/features/seo/jsonld";
import { routes } from "@/config/routes";

export const generateMetadata = staticPageMetadata("globalIssues", routes.globalIssues);

/**
 * Global issues: every global issue (not the custom regions, which are only
 * groupings of countries) as a photo card, full width over the map — the
 * Topics page's look for the other kind of content.
 */
export default async function GlobalIssuesPage({ params }: PageProps<"/[locale]/global-issues">) {
  const locale = await localeFrom(params);
  const t = (await getMessagesFor(locale)).globalIssues;
  const atlas = await getAtlas(locale);
  const site = await getSiteSettings();
  const { counts } = await topicIndex(atlas);
  const issues = atlas.issues.filter((group) => group.kind === "issue");
  const customRegions = atlas.issues.filter((group) => group.kind === "region");
  const countryName = (iso3: string) => atlas.countryByIso3.get(iso3)?.name;

  const cards = issues.map((issue) => ({
    slug: issue.slug,
    name: issue.name,
    subtitle: issue.subtitle,
    summary: issue.summary,
    hero: issue.hero,
    fill: issue.fill,
    topics: counts.issues[issue.slug]?.length ?? 0,
    status: issue.contentStatus,
    places: issue.countries.map(countryName).filter(Boolean).join(", "),
  }));
  // As on Topics: the first photo is the largest element, announce it early (LCP).
  const firstPhoto = safeUrl(cards.find((card) => card.hero)?.hero);
  if (firstPhoto)
    preload(photoUrl(firstPhoto, PHOTO_WIDTH.card), { as: "image", fetchPriority: "high" });

  const filters = issueFilters(issues, {
    regionOf: Object.fromEntries(atlas.countries.map((c) => [c.iso3, c.region?.slug])),
    customRegions,
  });
  // Names of the places that have at least one issue (the selects offer only those).
  const pick = (keys: string[], name: (key: string) => string | undefined) =>
    Object.fromEntries(keys.flatMap((key) => (name(key) ? [[key, name(key) as string]] : [])));
  const names = {
    country: pick(Object.keys(filters.country), countryName),
    region: pick(Object.keys(filters.region), (key) => atlas.regionBySlug.get(key)?.name),
    "custom-region": pick(
      Object.keys(filters["custom-region"]),
      (key) => atlas.issueBySlug.get(key)?.name,
    ),
  };

  return (
    <>
      {/* The static render lists everything; the filter and the search run in the browser. */}
      <IssuesBrowser
        title={t.title}
        intro={t.intro}
        items={cards}
        filters={filters}
        names={names}
      />

      <JsonLd
        data={collectionPageGraph({
          path: routes.globalIssues,
          name: t.title,
          description: t.description,
          locale,
          site,
          items: issues.map((issue) => ({ name: issue.name, path: routes.issue(issue.slug) })),
        })}
      />
    </>
  );
}
