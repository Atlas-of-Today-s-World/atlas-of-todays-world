import { ShareButton } from "@/components/atlas/ShareButton";
import Link from "@/components/i18n/Link";
import { RelatedTopics, TopicsLink } from "@/components/topics/RelatedTopics";
import { NoTopicsCta } from "@/components/topics/NoTopicsCta";
import type { EntrySummary } from "@/features/entries/types";
import { NewsBadge, PhotoCredit, SectionLabel } from "@/components/atlas/ui";
import type { RegionDossier } from "@/lib/content-types";
import type { RegionStat } from "@/features/geography/region-stats";
import { formatPopulation } from "@/lib/format";
import { cssBackgroundImage } from "@/lib/security/urls";
import { PHOTO_WIDTH } from "@/lib/images";
import { format, type Messages } from "@/lib/i18n/messages";
import { getRequestLocale, getT } from "@/lib/i18n/request";
import type { ContentStatus } from "@/features/geography/content-status";
import type { GroupKind, PortraitPlace } from "@/features/geography/kinds";
import { ContentStatusBadge } from "./ContentStatusBadge";
import { PortraitCounts } from "./PortraitCounts";
import {
  ComingSections,
  FaqList,
  IndicatorCards,
  PatronsCallout,
  ResourceLibrary,
} from "./sections";
import { Timeline } from "./Timeline";
import { VisualsCarousel } from "@/components/visuals/VisualsCarousel";

/** What the portrait shows — an Atlas region, or an editorial global issue. */
export interface PortraitSubject {
  kind: PortraitPlace;
  name: string;
  subtitle?: string;
  /** Summary from Atlas data; replaced by the editorial intro (`dossier.intro`). */
  summary: string;
  hero?: string | null;
  /** Who took the header photo (shown in its corner). */
  heroCredit?: string;
  /** Color of the group on the map (stripe under the heading for a global issue). */
  accent?: string;
  /** For a group of countries: a global topic, or a custom region (different label). */
  groupKind?: GroupKind;
  countries: { slug: string; name: string }[];
  population: number;
  /** Without country data (Antarctica): the indicator cards are left out. */
  showMetrics?: boolean;
  /** How far the editors are; untouched places ask for support. Left out = no badge. */
  status?: ContentStatus;
}

/** Texts that differ for a region and for a group of countries (global issue). */
function wordingFor(kind: PortraitPlace, t: Messages, groupKind?: GroupKind) {
  const region = kind === "region";
  return {
    label: region
      ? null
      : groupKind === "region"
        ? t.portrait.customRegion
        : t.portrait.globalIssue,
    timelineEmpty: region ? t.portrait.timelineEmptyRegion : t.portrait.timelineEmptyGroup,
    mapsEmpty: region ? t.portrait.mapsEmptyRegion : t.portrait.mapsEmptyGroup,
    faqEmpty: region ? t.portrait.faqEmptyRegion : t.portrait.faqEmptyGroup,
  };
}

/**
 * Portrait of a region or a global issue (ARCHITEKTURA 15.1, D3). Per the brief
 * there is only one – no short and long version – and it opens in full right away.
 * Topics belong to regions and countries only (owner's decision of 2026-10-15):
 * a global issue's page gets no `topics`. Its countries are listed under the
 * count in the header, not in a section of their own.
 *
 * Sections the editors haven't written anything for yet are listed at the end
 * with a call for support. Key indicators have data everywhere, because they're
 * computed from imported data, not editorial text.
 */
export default async function Portrait({
  subject,
  newsCount,
  dossier,
  stats,
  topics,
}: {
  subject: PortraitSubject;
  /** Topics about the region and the filtered Topics list. */
  topics?: { items: EntrySummary[]; href: string };
  /** News published about the group (the count under a global issue's intro). */
  newsCount: number;
  dossier: RegionDossier;
  stats: RegionStat[];
}) {
  const t = await getT();
  const wording = wordingFor(subject.kind, t, subject.groupKind);
  const hero = cssBackgroundImage(subject.hero, PHOTO_WIDTH.card);
  const complete = profileComplete(dossier);

  return (
    <article>
      {hero ? (
        <div className="relative">
          <div
            className="h-52 w-full bg-cover bg-center"
            style={{ backgroundImage: hero }}
            role="img"
            aria-label={format(t.ui.fromOrbit, { name: subject.name })}
          />
          {subject.heroCredit ? <PhotoCredit onPhoto>{subject.heroCredit}</PhotoCredit> : null}
        </div>
      ) : null}

      <header className="px-6 pt-7 pb-7 sm:px-10">
        {/* Sharing sits above the heading, at the right of the label. Without a
            photo the panel's close button (×) takes that corner, so it moves in. */}
        <div className={`flex flex-wrap items-center justify-between gap-2 ${hero ? "" : "pr-12"}`}>
          {wording.label ? <SectionLabel>{wording.label}</SectionLabel> : <span aria-hidden />}
          <ShareButton title={subject.name} className="ml-auto flex-row-reverse" />
        </div>
        <h1 className="font-display mt-4 text-[30px] leading-tight font-bold text-[var(--color-ink)]">
          {subject.name}
        </h1>
        {subject.subtitle ? (
          <p className="font-display mt-1 text-[15px] font-bold text-[var(--color-link)]">
            {subject.subtitle}
          </p>
        ) : null}
        {subject.status ? (
          <div className="mt-3">
            <ContentStatusBadge status={subject.status} t={t} />
          </div>
        ) : null}
        {subject.accent ? (
          <div
            className="mt-4 h-2 w-full rounded-full"
            style={{ background: subject.accent }}
            aria-hidden
          />
        ) : null}
        {/* The intro paragraph is written by the editors; without it the Atlas data summary stays. */}
        <p className="mt-3 text-[13.5px] leading-relaxed whitespace-pre-line text-[var(--color-ink-soft)]">
          {dossier.intro?.trim() || subject.summary}
        </p>
        {subject.kind === "issue" ? (
          <div className="mt-4">
            <NewsBadge count={newsCount} />
          </div>
        ) : null}
        {/* The way to the place's topics comes first, above the counts. */}
        {topics ? (
          <>
            <TopicsLink count={topics.items.length} href={topics.href} className="mt-5" />
            <NoTopicsCta count={topics.items.length} place={subject.name} className="mt-4" />
          </>
        ) : null}
        <PortraitCounts
          countries={subject.countries}
          population={formatPopulation(subject.population, getRequestLocale())}
        />
      </header>

      {/* The editors' key facts (sourced cards) everywhere; computed figures only for a
          global issue — regional averages confused readers (decision of 2026-10-07),
          national figures live on each country. */}
      {subject.kind === "issue" ? (
        subject.showMetrics !== false ? (
          <IndicatorCards stats={stats} metrics={dossier.metrics} />
        ) : null
      ) : (
        <IndicatorCards metrics={dossier.metrics} />
      )}

      <ProfileSections kind={subject.kind} groupKind={subject.groupKind} dossier={dossier} />

      {topics ? (
        <RelatedTopics
          items={topics.items}
          href={topics.href}
          place={subject.name}
          className="mt-2 px-6 pb-8 sm:px-10"
        />
      ) : null}

      <PatronsCallout complete={complete} />

      <p className="px-6 pb-8 text-center text-[11.5px] text-[var(--color-ink-muted)] sm:px-10">
        <Link href="/" className="inline-flex min-h-(--touch-min) items-center hover:underline">
          ← {t.common.backToGlobe}
        </Link>
      </p>
    </article>
  );
}

/**
 * The body of a regional profile, the same wherever it is shown: on the
 * region's or global issue's own page and under each of the region's
 * countries (RegionalProfile) — written once, shown in both places.
 * Timeline, maps & charts, further resources and FAQ; what the editors
 * haven't written yet is listed at the end with the support call.
 */
export async function ProfileSections({
  kind,
  groupKind,
  dossier,
}: {
  kind: PortraitPlace;
  groupKind?: GroupKind;
  dossier: RegionDossier;
}) {
  const t = await getT();
  const wording = wordingFor(kind, t, groupKind);
  // Sections without content yet: listed once at the end, not as grey placeholders.
  const coming = [
    !dossier.timeline?.length && { title: t.portrait.timeline, lead: wording.timelineEmpty },
    !dossier.visuals?.length && { title: t.portrait.maps, lead: wording.mapsEmpty },
    !dossier.resources?.length && { title: t.portrait.learnMore, lead: t.portrait.learnMoreEmpty },
    !dossier.faq?.length && { title: t.portrait.faq, lead: wording.faqEmpty },
  ].filter((item): item is { title: string; lead: string } => Boolean(item));
  return (
    <>
      {dossier.timeline?.length ? (
        <Timeline
          items={dossier.timeline}
          title={dossier.timelineTitle}
          subtitle={dossier.timelineSubtitle}
        />
      ) : null}

      {dossier.visuals?.length ? (
        <VisualsCarousel items={dossier.visuals} lead={t.portrait.mapsLead} />
      ) : null}

      {dossier.resources?.length ? <ResourceLibrary resources={dossier.resources} /> : null}

      {dossier.faq?.length ? <FaqList items={dossier.faq} /> : null}

      <ComingSections items={coming} />
    </>
  );
}

/** Whether the editors finished the regional profile (the support call changes its words). */
export const profileComplete = (dossier: RegionDossier) =>
  Boolean(dossier.timeline?.length && dossier.resources?.length && dossier.faq?.length);
