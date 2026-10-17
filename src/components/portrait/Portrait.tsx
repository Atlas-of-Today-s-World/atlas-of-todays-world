import { Fragment, type ReactNode } from "react";
import { ShareButton } from "@/components/atlas/ShareButton";
import Link from "@/components/i18n/Link";
import { TopicsLink } from "@/components/topics/RelatedTopics";
import type { EntrySummary } from "@/features/entries/types";
import { PhotoCredit } from "@/components/atlas/ui";
import type { RegionDossier } from "@/lib/content-types";
import { formatPopulation } from "@/lib/format";
import { Photo } from "@/components/atlas/Photo";
import { PHOTO_SIZES } from "@/config/layout";
import { safeUrl } from "@/lib/security/urls";
import { PHOTO_WIDTH } from "@/lib/images";
import { format } from "@/lib/i18n/messages";
import { getRequestLocale, getT } from "@/lib/i18n/request";
import type { GroupStatus } from "@/features/geography/content-status";
import { ContentStatusBadge } from "./ContentStatusBadge";
import { PortraitCounts } from "./PortraitCounts";
import { FaqList, IndicatorCards, PatronsCallout, ResourceLibrary } from "./sections";
import { Timeline } from "./Timeline";
import { VisualsCarousel } from "@/components/visuals/VisualsCarousel";
import { ThemeTopics } from "@/components/topics/ThemeTopics";
import type { SectionKey } from "@/features/portraits/section-order";
import { getSiteSettings } from "@/features/site/queries";

/** What the portrait shows — an Atlas region. */
export interface PortraitSubject {
  name: string;
  subtitle?: string;
  /** Summary from Atlas data; replaced by the editorial intro (`dossier.intro`). */
  summary: string;
  hero?: string | null;
  /** Who took the header photo (shown in its corner). */
  heroCredit?: string;
  countries: { slug: string; name: string }[];
  population: number;
  /** How far the editors are; untouched places ask for support. Left out = no badge. */
  status?: GroupStatus;
}

/**
 * Portrait of a region in the wide side panel (ARCHITEKTURA 15.1, D3). Per the
 * brief there is only one – no short and long version – and it opens in full
 * right away. A global issue has its own full-width page (IssueArticle, owner's
 * request of 2026-10-16) built from the same sections (`ProfileSections`). The
 * region's countries are listed under the count in the header, not in a
 * section of their own.
 *
 * Sections the editors haven't written anything for yet are left out; the
 * call for support closes the page. Key indicators are the editors' sourced
 * cards only: regional averages confused readers (decision of 2026-10-07),
 * national figures live on each country.
 */
export default async function Portrait({
  subject,
  dossier,
  topics,
}: {
  subject: PortraitSubject;
  /** Topics about the region and the filtered Topics list. */
  topics?: { items: EntrySummary[]; href: string };
  dossier: RegionDossier;
}) {
  const t = await getT();
  const hero = safeUrl(subject.hero);
  const complete = profileComplete(dossier);

  return (
    <article>
      {hero ? (
        <div className="relative">
          {/* The panel's LCP: a real <img> in the width the panel shows, preloaded. */}
          <Photo
            priority
            src={hero}
            alt={format(t.ui.fromOrbit, { name: subject.name })}
            widths={[PHOTO_WIDTH.tile, PHOTO_WIDTH.card, 1200]}
            sizes={PHOTO_SIZES.wideRail}
            width={1200}
            height={416}
            className="h-52 w-full object-cover"
          />
          {subject.heroCredit ? <PhotoCredit onPhoto>{subject.heroCredit}</PhotoCredit> : null}
        </div>
      ) : null}

      <header className="px-6 pt-7 pb-7 sm:px-10">
        {/* Sharing sits above the heading, at the right. Without a photo the
            panel's close button (×) takes that corner, so it moves in. */}
        <div className={`flex flex-wrap items-center justify-between gap-2 ${hero ? "" : "pr-12"}`}>
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
        {/* The intro paragraph is written by the editors; without it the Atlas data summary stays. */}
        <p className="mt-3 text-[13.5px] leading-relaxed whitespace-pre-line text-[var(--color-ink-soft)]">
          {dossier.intro?.trim() || subject.summary}
        </p>
        {/* A quick way to the place's topics, above the counts; the rows by theme
            (and, with none written, the invitation) come in their slot below. */}
        {topics ? (
          <TopicsLink count={topics.items.length} href={topics.href} className="mt-5" />
        ) : null}
        <PortraitCounts
          countries={subject.countries}
          population={formatPopulation(subject.population, getRequestLocale())}
        />
      </header>

      <IndicatorCards metrics={dossier.metrics} />

      <ProfileSections dossier={dossier} topics={topics} place={subject.name} />

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
 * The run of sections every place shows — a country, a region and a global
 * issue, in the side-panel preview and on the full page, and the region's
 * profile under each of its countries — written once (owner's request of
 * 2026-10-16). Their order is one for the whole site and comes from the admin
 * (Portrait layout → `site_settings.portrait_sections`); a section the editors
 * haven't written is left out wherever it stands. The intro and key facts sit
 * above this run, the call for support below it.
 *
 * `topics` is optional: under a country the region's profile leaves the topics
 * out, because the country's own list (which already holds its region's
 * topics) follows right after it — showing them twice would repeat every tile.
 */
export async function ProfileSections({
  dossier,
  topics,
  place,
  timelineId,
}: {
  dossier: RegionDossier;
  /** The place's topics and the filtered Topics list; left out = no topic rows. */
  topics?: { items: EntrySummary[]; href: string };
  /** Name of the place, for the invitation under the topic rows. */
  place?: string;
  /** Element id of the timeline when two share a page (a country under its region). */
  timelineId?: string;
}) {
  const [t, { sectionOrder }] = await Promise.all([getT(), getSiteSettings()]);

  const sections: Record<SectionKey, ReactNode> = {
    timeline: dossier.timeline?.length ? (
      <Timeline
        id={timelineId}
        items={dossier.timeline}
        title={dossier.timelineTitle}
        subtitle={dossier.timelineSubtitle}
      />
    ) : null,
    topics: topics ? (
      <ThemeTopics items={topics.items} href={topics.href} place={place ?? ""} />
    ) : null,
    visuals: dossier.visuals?.length ? (
      <VisualsCarousel items={dossier.visuals} lead={t.portrait.mapsLead} />
    ) : null,
    resources: dossier.resources?.length ? <ResourceLibrary resources={dossier.resources} /> : null,
    faq: dossier.faq?.length ? <FaqList items={dossier.faq} /> : null,
  };

  return (
    <>
      {sectionOrder.map((key) => (
        <Fragment key={key}>{sections[key]}</Fragment>
      ))}
    </>
  );
}

/** Whether the editors finished the regional profile (the support call changes its words). */
export const profileComplete = (dossier: RegionDossier) =>
  Boolean(dossier.timeline?.length && dossier.resources?.length && dossier.faq?.length);
