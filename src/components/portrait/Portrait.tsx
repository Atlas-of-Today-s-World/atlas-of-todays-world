import Link from "@/components/i18n/Link";
import { NewsBadge, SectionLabel } from "@/components/atlas/ui";
import type { RegionDossier } from "@/lib/content-types";
import type { RegionStat } from "@/lib/region-stats";
import { formatPopulation } from "@/lib/format";
import { cssBackgroundImage } from "@/lib/security/urls";
import { format, type Messages } from "@/features/i18n/messages";
import { getRequestLocale, getT } from "@/features/i18n/request";
import NewsTabs, { type NewsCard } from "./NewsTabs";
import {
  EmptySection,
  ENTRY_CATEGORIES,
  FaqList,
  IndicatorCards,
  PatronsCallout,
  PortraitSection,
  ResourceLibrary,
  ThematicEntries,
  Timeline,
  VisualCarousel,
  type PlannedEntry,
} from "./sections";

/** What the portrait shows — an Atlas region, or an editorial global issue. */
export interface PortraitSubject {
  kind: "region" | "issue";
  name: string;
  subtitle?: string;
  /** Summary from Atlas data; replaced by the editorial intro (`dossier.intro`). */
  summary: string;
  hero?: string | null;
  /** Color of the group on the map (stripe under the heading for a global issue). */
  accent?: string;
  /** For a group of countries: a global topic, or a custom region (different label). */
  groupKind?: "issue" | "region";
  countries: { slug: string; name: string }[];
  population: number;
}

/** Texts that differ for a region and for a group of countries (global issue). */
function wordingFor(kind: "region" | "issue", t: Messages, groupKind?: "issue" | "region") {
  const region = kind === "region";
  return {
    label: region
      ? null
      : groupKind === "region"
        ? t.portrait.customRegion
        : t.portrait.globalIssue,
    countriesTitle: region ? t.portrait.countriesInRegion : t.portrait.countriesInGroup,
    timelineEmpty: region ? t.portrait.timelineEmptyRegion : t.portrait.timelineEmptyGroup,
    mapsEmpty: region ? t.portrait.mapsEmptyRegion : t.portrait.mapsEmptyGroup,
    faqEmpty: region ? t.portrait.faqEmptyRegion : t.portrait.faqEmptyGroup,
  };
}

/**
 * Portrait of a region or a global issue (ARCHITEKTURA 15.1, D3). Per the brief
 * there is only one – no short and long version – and it opens in full right away.
 *
 * Sections the editors haven't written anything for yet aren't skipped: they're drawn
 * grey and non-clickable, with a call for support. Key indicators have data
 * everywhere, because they're computed from imported data, not editorial text.
 */
export default function Portrait({
  subject,
  news,
  entries,
  dossier,
  stats,
}: {
  subject: PortraitSubject;
  news: NewsCard[];
  /** Encyclopedia entries (P9): published ones with a link, planned ones with `slug: null`. */
  entries: PlannedEntry[];
  dossier: RegionDossier;
  stats: RegionStat[];
}) {
  const t = getT();
  const wording = wordingFor(subject.kind, t, subject.groupKind);
  const hero = cssBackgroundImage(subject.hero);
  const complete = Boolean(
    dossier.timeline?.length && dossier.resources?.length && dossier.faq?.length,
  );

  return (
    <article>
      {hero ? (
        <div
          className="h-52 w-full bg-cover bg-center"
          style={{ backgroundImage: hero }}
          role="img"
          aria-label={format(t.ui.fromOrbit, { name: subject.name })}
        />
      ) : null}

      <header className="px-6 pt-7 pb-7 sm:px-10">
        {wording.label ? <SectionLabel>{wording.label}</SectionLabel> : null}
        <h1
          className={`font-display text-[30px] leading-tight font-bold text-[var(--color-ink)] ${
            wording.label ? "mt-4" : ""
          }`}
        >
          {subject.name}
        </h1>
        {subject.subtitle ? (
          <p className="font-display mt-1 text-[15px] font-bold text-[var(--color-link)]">
            {subject.subtitle}
          </p>
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
            <NewsBadge count={news.length} />
          </div>
        ) : null}
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--color-line)] pt-4 text-[12.5px]">
          <div>
            <dt className="text-[var(--color-ink-muted)]">{t.portrait.countries}</dt>
            <dd className="font-medium text-[var(--color-ink)]">{subject.countries.length}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-ink-muted)]">{t.portrait.people}</dt>
            <dd className="font-medium text-[var(--color-ink)]">
              {formatPopulation(subject.population, getRequestLocale())}
            </dd>
          </div>
        </dl>
      </header>

      <IndicatorCards stats={stats} metrics={dossier.metrics} />

      {dossier.timeline?.length ? (
        <Timeline
          items={dossier.timeline}
          title={dossier.timelineTitle}
          subtitle={dossier.timelineSubtitle}
        />
      ) : (
        <EmptySection title={t.portrait.timeline} lead={wording.timelineEmpty} />
      )}

      <ThematicEntries entries={plannedEntries(subject.name, entries, t)} />

      {dossier.visuals?.length ? (
        <VisualCarousel visuals={dossier.visuals} />
      ) : (
        <EmptySection title={t.portrait.maps} lead={wording.mapsEmpty} rows={2} />
      )}

      {news.length ? <NewsTabs newsItems={news} /> : null}

      {dossier.resources?.length ? (
        <ResourceLibrary resources={dossier.resources} />
      ) : (
        <EmptySection title={t.portrait.learnMore} lead={t.portrait.learnMoreEmpty} rows={2} />
      )}

      {dossier.faq?.length ? (
        <FaqList items={dossier.faq} />
      ) : (
        <EmptySection title={t.portrait.faq} lead={wording.faqEmpty} rows={3} />
      )}

      <PortraitSection title={wording.countriesTitle}>
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {subject.countries.map((country) => (
            <li key={country.slug}>
              <Link
                href={`/country/${country.slug}`}
                className="inline-flex min-h-8 items-center rounded-full border border-[var(--color-line)] px-2.5 text-[12px] text-[var(--color-ink-soft)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              >
                {country.name}
              </Link>
            </li>
          ))}
        </ul>
      </PortraitSection>

      <PatronsCallout complete={complete} />

      <p className="px-6 pb-8 text-center text-[11.5px] text-[var(--color-ink-muted)] sm:px-10">
        <Link href="/" className="inline-flex min-h-11 items-center hover:underline">
          ← {t.common.backToGlobe}
        </Link>
      </p>
    </article>
  );
}

/** News item → portrait card (only what the client component needs). */
export function newsCards(
  items: {
    slug: string;
    title: string;
    summary: string;
    category: NewsCard["category"];
    hero?: string;
  }[],
): NewsCard[] {
  return items.map(({ slug, title, summary, category, hero }) => ({
    slug,
    title,
    summary,
    category,
    hero,
  }));
}

/**
 * Entries by four topics. Where the editors haven't written or planned any entry
 * yet, we show at least the generic topics – greyed out.
 */
function plannedEntries(name: string, entries: PlannedEntry[], t: Messages): PlannedEntry[] {
  const planned: PlannedEntry[] = entries.map((entry) => ({
    ...entry,
    category: entryCategory(entry.category),
  }));
  for (const category of ENTRY_CATEGORIES) {
    const have = planned.filter((entry) => entry.category === category).length;
    for (let index = have; index < 3; index += 1) {
      planned.push({
        title: format(t.portrait.plannedTitle, {
          category: t.categories[category],
          place: name,
          index: String(index + 1),
        }),
        category,
        slug: null,
      });
    }
  }
  return planned;
}

/** Atlas news categories mapped to the four topic groups from the brief. */
function entryCategory(category: string): string {
  switch (category) {
    case "Living Conditions":
    case "Society":
    case "Historical Roots":
      return category;
    case "Political System":
    case "International Relations":
      return "Politics & International Relations";
    default:
      return "Society";
  }
}
