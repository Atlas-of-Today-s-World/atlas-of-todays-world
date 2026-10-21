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
import type { RegionStat } from "@/features/geography/region-stats";
import type { GlobalIssue } from "@/features/geography/types";
import type { RegionDossier } from "@/lib/content-types";
import { formatPopulation } from "@/lib/format";
import { getRequestLocale, getT } from "@/lib/i18n/request";
import { routes } from "@/config/routes";

/**
 * A global issue (or a custom region — the same table, the same page) as a
 * full-width page like a topic (owner's request of 2026-10-16): the photo
 * header with the trail Atlas › Global issues › kind, title, subtitle, summary
 * and Share; then the editors' intro, its countries as links, the key facts,
 * the topics written about it as "Subtopics" tiles (or the invitation to write
 * the first one), and the rest of its portrait — timeline, maps & charts,
 * sources, FAQ, the call for support. The globe waits in its corner window
 * with the issue's countries lit (issue mode), turned to them without zooming.
 */
export async function IssueArticle({
  issue,
  dossier,
  stats,
  topics,
  countries,
  population,
}: {
  issue: GlobalIssue;
  dossier: RegionDossier;
  /** Figures computed from imported data (shown when the editors wrote no key facts). */
  stats: RegionStat[];
  /** Topics written about the issue and the Topics list filtered to it. */
  topics: PlaceTopics;
  countries: { slug: string; name: string }[];
  population: number;
}) {
  const t = await getT();
  const intro = dossier.intro?.trim();
  return (
    <>
      {/* The corner window shows the whole globe turned to the issue: no zoom. */}
      <RegionFocus region={issue} zoom={null} />
      {/* Issue mode lights the issue's countries and greys the rest, in the window too. */}
      <MapModeSetter mode="issue" />

      <article>
        <ArticleHero
          image={issue.hero}
          alt={issue.name}
          wash={heroWash(issue.fill)}
          credit={issue.heroCredit}
          crumbLabel={t.article.breadcrumb}
          // The way back: Atlas › Global issues › what kind of group this is.
          crumbs={[
            { label: t.article.breadcrumbAtlas, href: "/" },
            {
              label: t.globalIssues.title,
              href: routes.globalIssues,
              pill: true,
              icon: <Globe2 aria-hidden className="size-3.5" />,
            },
            { label: issue.kind === "region" ? t.portrait.customRegion : t.portrait.globalIssue },
          ]}
          share={issue.name}
          title={issue.name}
          subtitle={issue.subtitle}
          summary={issue.summary}
        />

        <div className={ARTICLE_BODY}>
          <ContentStatusBadge status={issue.contentStatus} t={t} />
          {/* The editors' intro; the Atlas summary is already under the title. */}
          {intro && intro !== issue.summary ? (
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
            <IndicatorCards stats={stats} metrics={dossier.metrics} />
          </div>

          {/* Timeline, topics by theme, maps, sources, FAQ — in the admin's order. */}
          <div className={`${PANEL_SECTION_BLEED} mt-12`}>
            <ProfileSections dossier={dossier} topics={topics} place={issue.name} />
            <PatronsCallout complete={profileComplete(dossier)} />
          </div>

          <ArticleEnd href={routes.globalIssues} label={t.map.allIssues} share={issue.name} />
        </div>
      </article>
    </>
  );
}
