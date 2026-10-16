import { ShareButton } from "@/components/atlas/ShareButton";
import Link from "@/components/i18n/Link";
import { RelatedTopics, TopicsLink } from "@/components/topics/RelatedTopics";
import { NoTopicsCta } from "@/components/topics/NoTopicsCta";
import type { EntrySummary } from "@/features/entries/types";
import { PhotoCredit } from "@/components/atlas/ui";
import type { RegionDossier } from "@/lib/content-types";
import { formatPopulation } from "@/lib/format";
import { cssBackgroundImage } from "@/lib/security/urls";
import { PHOTO_WIDTH } from "@/lib/images";
import { format } from "@/lib/i18n/messages";
import { getRequestLocale, getT } from "@/lib/i18n/request";
import type { ContentStatus } from "@/features/geography/content-status";
import { ContentStatusBadge } from "./ContentStatusBadge";
import { PortraitCounts } from "./PortraitCounts";
import { FaqList, IndicatorCards, PatronsCallout, ResourceLibrary } from "./sections";
import { Timeline } from "./Timeline";
import { VisualsCarousel } from "@/components/visuals/VisualsCarousel";

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
  status?: ContentStatus;
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

      <IndicatorCards metrics={dossier.metrics} />

      <ProfileSections dossier={dossier} />

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
 * region's own page, under each of the region's countries (RegionalProfile)
 * and on a global issue's full-width page (IssueArticle) — written once,
 * shown in every place. Timeline, maps & charts, further resources and FAQ —
 * each only once the editors have written it (empty parts are left out; the
 * support call follows below).
 */
export async function ProfileSections({ dossier }: { dossier: RegionDossier }) {
  const t = await getT();
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
    </>
  );
}

/** Whether the editors finished the regional profile (the support call changes its words). */
export const profileComplete = (dossier: RegionDossier) =>
  Boolean(dossier.timeline?.length && dossier.resources?.length && dossier.faq?.length);
