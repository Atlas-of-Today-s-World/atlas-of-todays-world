import Link from "@/components/i18n/Link";
import { NewsBadge, SectionLabel } from "@/components/atlas/ui";
import type { RegionDossier } from "@/lib/content-types";
import type { RegionStat } from "@/lib/region-stats";
import { formatPopulation } from "@/lib/format";
import { cssBackgroundImage } from "@/lib/security/urls";
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

/** Co portrét zobrazuje — region Atlasu, nebo global issue redakce. */
export interface PortraitSubject {
  kind: "region" | "issue";
  name: string;
  subtitle?: string;
  /** Shrnutí z dat Atlasu; nahradí ho úvod redakce (`dossier.intro`). */
  summary: string;
  hero?: string | null;
  /** Barva celku na mapě (proužek pod nadpisem u global issue). */
  accent?: string;
  countries: { slug: string; name: string }[];
  population: number;
}

const WORDING = {
  region: { label: null, place: "region", countriesTitle: "Countries in this region" },
  issue: { label: "Global Issue", place: "group", countriesTitle: "Countries in this group" },
} as const;

/**
 * Portrét regionu i global issue (ARCHITEKTURA 15.1, D3). Podle zadání
 * existuje jen jeden – žádná krátká a dlouhá verze – a otevírá se rovnou celý.
 *
 * Sekce, ke kterým redakce zatím nic nenapsala, se nevynechávají: kreslí se
 * šedivé a nekliknutelné, s výzvou k podpoře. Klíčové ukazatele mají data
 * všude, protože se počítají z importovaných dat, ne z redakčního textu.
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
  /** Encyklopedická hesla (P9): zveřejněná s odkazem, plánovaná se `slug: null`. */
  entries: PlannedEntry[];
  dossier: RegionDossier;
  stats: RegionStat[];
}) {
  const wording = WORDING[subject.kind];
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
          aria-label={`${subject.name} seen from orbit`}
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
        {/* Úvodní odstavec píše redakce; bez něj zůstává shrnutí z dat Atlasu. */}
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
            <dt className="text-[var(--color-ink-muted)]">Countries</dt>
            <dd className="font-medium text-[var(--color-ink)]">{subject.countries.length}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-ink-muted)]">People</dt>
            <dd className="font-medium text-[var(--color-ink)]">
              {formatPopulation(subject.population)}
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
        <EmptySection
          title="How the present came about"
          lead={`An interactive timeline of the events behind the ${wording.place}'s current situation.`}
        />
      )}

      <ThematicEntries entries={plannedEntries(subject.name, entries)} />

      {dossier.visuals?.length ? (
        <VisualCarousel visuals={dossier.visuals} />
      ) : (
        <EmptySection
          title="Maps & charts"
          lead={`A carousel of interactive infographics and maps for this ${wording.place}.`}
          rows={2}
        />
      )}

      {news.length ? <NewsTabs newsItems={news} /> : null}

      {dossier.resources?.length ? (
        <ResourceLibrary resources={dossier.resources} />
      ) : (
        <EmptySection
          title="Learn more elsewhere"
          lead="Videos & documentaries, lectures & debates, articles, reports & books, educational resources, statistics & databases."
          rows={2}
        />
      )}

      {dossier.faq?.length ? (
        <FaqList items={dossier.faq} />
      ) : (
        <EmptySection
          title="Common questions"
          lead={`The five questions people ask most often about this ${wording.place}.`}
          rows={3}
        />
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
          ← Back to the globe
        </Link>
      </p>
    </article>
  );
}

/** Novinka → karta portrétu (klientské komponentě jen to, co potřebuje). */
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
 * Hesla podle čtyř témat. Kde redakce zatím žádné heslo nenapsala ani
 * nenaplánovala, ukazujeme aspoň obecná témata – šedivě.
 */
function plannedEntries(name: string, entries: PlannedEntry[]): PlannedEntry[] {
  const planned: PlannedEntry[] = entries.map((entry) => ({
    ...entry,
    category: entryCategory(entry.category),
  }));
  for (const category of ENTRY_CATEGORIES) {
    const have = planned.filter((entry) => entry.category === category).length;
    for (let index = have; index < 3; index += 1) {
      planned.push({ title: `${category} in ${name} (${index + 1})`, category, slug: null });
    }
  }
  return planned;
}

/** Kategorie novinek Atlasu na čtyři tematické skupiny ze zadání. */
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
