import { Globe2 } from "lucide-react";
import {
  ARTICLE_BODY,
  ArticleEnd,
  ArticleHero,
  PANEL_SECTION_BLEED,
  heroWash,
} from "@/components/atlas/ArticleHero";
import MapModeSetter from "@/components/map/MapModeSetter";
import RegionFocus from "@/components/map/RegionFocus";
import { ContentStatusBadge } from "@/components/portrait/ContentStatusBadge";
import { ProfileSections, profileComplete } from "@/components/portrait/Portrait";
import { PortraitCounts } from "@/components/portrait/PortraitCounts";
import { IndicatorCards, PatronsCallout } from "@/components/portrait/sections";
import type { PlaceTopics } from "@/features/entries/types";
import type { Region } from "@/features/geography/types";
import type { RegionDossier } from "@/lib/content-types";
import { formatPopulation } from "@/lib/format";
import { getRequestLocale, getT } from "@/lib/i18n/request";
import { routes } from "@/config/routes";

/**
 * An Atlas region as a full-width page (owner's request of 2026-10-16), built
 * from the same parts as a global issue (IssueArticle) — the region used to
 * open in the side panel and so could not hold its whole portrait.
 *
 * The photo header carries the trail Atlas › Countries and regions › Region,
 * the name, the tagline and the Atlas summary; the body then runs the editors'
 * intro, the countries, the key facts, the topics written about the region as
 * "Subtopics" tiles, and the rest of the portrait — timeline, maps & charts,
 * sources, FAQ, the call for support. It ends bottom-left with Back to Atlas.
 *
 * Key facts are the editors' sourced cards only: regional averages confused
 * readers (decision of 2026-10-07), so no computed figures are passed in.
 */
export async function RegionArticle({
  region,
  dossier,
  topics,
  countries,
  population,
}: {
  region: Region;
  dossier: RegionDossier;
  /** Topics written about the region and the Topics list filtered to it. */
  topics: PlaceTopics;
  countries: { slug: string; name: string }[];
  population: number;
}) {
  const t = await getT();
  const intro = dossier.intro?.trim();
  return (
    <>
      {/* The corner window turns the globe to the region and outlines its countries. */}
      <RegionFocus region={region} />
      {/* Regions mode, so the switcher above the map matches a link opened from outside. */}
      <MapModeSetter mode="regions" />

      <article>
        <ArticleHero
          image={region.hero}
          alt={region.name}
          wash={heroWash(region.fill)}
          credit={region.heroCredit}
          crumbLabel={t.article.breadcrumb}
          crumbs={[
            { label: t.article.breadcrumbAtlas, href: "/" },
            {
              label: t.countriesIndex.heading,
              href: routes.countries,
              pill: true,
              icon: <Globe2 aria-hidden className="size-3.5" />,
            },
            { label: t.map.modeRegions },
          ]}
          share={region.name}
          title={region.name}
          subtitle={region.tagline}
          summary={region.summary}
        />

        <div className={ARTICLE_BODY}>
          <ContentStatusBadge status={region.contentStatus} t={t} />
          {/* The editors' intro; the Atlas summary is already under the title. */}
          {intro && intro !== region.summary ? (
            <p className="mt-6 max-w-4xl text-[15px] leading-relaxed whitespace-pre-line text-[var(--color-ink-soft)]">
              {intro}
            </p>
          ) : null}
          <PortraitCounts
            countries={countries}
            population={formatPopulation(population, getRequestLocale())}
            initiallyOpen
          />

          <div className={`${PANEL_SECTION_BLEED} mt-8`}>
            <IndicatorCards metrics={dossier.metrics} />
          </div>

          {/* Timeline, topics by theme, maps, sources, FAQ — in the admin's order. */}
          <div className={`${PANEL_SECTION_BLEED} mt-12`}>
            <ProfileSections dossier={dossier} topics={topics} place={region.name} />
            <PatronsCallout complete={profileComplete(dossier)} />
          </div>

          {/* Bottom left: the way back to the globe. */}
          <ArticleEnd href="/" label={t.topics.backToAtlas} share={region.name} />
        </div>
      </article>
    </>
  );
}
