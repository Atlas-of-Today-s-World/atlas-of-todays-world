import Link from "next/link";
import type { Region } from "@/data/regions";
import type { NewsItem, RegionDossier } from "@/lib/content";
import type { RegionStat } from "@/lib/region-stats";
import { formatPopulation } from "@/lib/region-stats";
import NewsTabs from "./NewsTabs";
import {
  EmptySection,
  ENTRY_CATEGORIES,
  FaqList,
  IndicatorCards,
  PatronsCallout,
  ResourceLibrary,
  ThematicEntries,
  Timeline,
  VisualCarousel,
  type PlannedEntry,
} from "./PortraitSections";

/**
 * Portrét regionu. Podle zadání existuje jen jeden – žádná krátká a dlouhá
 * verze – a otevírá se rovnou celý.
 *
 * Sekce, ke kterým redakce zatím nic nenapsala, se nevynechávají: kreslí se
 * šedivé a nekliknutelné, s výzvou k podpoře. Klíčové ukazatele mají data
 * všude, protože se počítají z importovaných dat, ne z redakčního textu.
 */
export default function RegionPortrait({
  region,
  newsItems,
  dossier,
  stats,
  countryCount,
  population,
}: {
  region: Region;
  newsItems: NewsItem[];
  dossier: RegionDossier;
  stats: RegionStat[];
  countryCount: number;
  population: number;
}) {
  const planned: PlannedEntry[] = newsItems.map((item) => ({
    title: item.title,
    category: mapCategory(item.category),
    slug: item.slug,
  }));

  // Dokud redakce nenapíše hesla, ukazujeme aspoň plánovaná témata – šedivě.
  const withPlaceholders: PlannedEntry[] = [...planned];
  for (const category of ENTRY_CATEGORIES) {
    const have = withPlaceholders.filter((entry) => entry.category === category).length;
    for (let index = have; index < 3; index += 1) {
      withPlaceholders.push({
        title: `${category} in ${region.name} (${index + 1})`,
        category,
        slug: null,
      });
    }
  }

  const complete = Boolean(
    dossier.timeline?.length && dossier.resources?.length && dossier.faq?.length,
  );

  return (
    <article>
      <div
        className="h-52 w-full bg-cover bg-center"
        style={{ backgroundImage: `url(${region.hero})` }}
        role="img"
        aria-label={`${region.name} seen from orbit`}
      />

      <header className="px-6 pb-7 pt-7 sm:px-10">
        <h1 className="font-display text-[30px] font-bold leading-tight text-[var(--color-ink)]">
          {region.name}
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--color-ink-soft)]">
          {region.summary}
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--color-line)] pt-4 text-[12.5px]">
          <div>
            <dt className="text-[var(--color-ink-muted)]">Countries</dt>
            <dd className="font-medium text-[var(--color-ink)]">{countryCount}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-ink-muted)]">People</dt>
            <dd className="font-medium text-[var(--color-ink)]">
              {formatPopulation(population)}
            </dd>
          </div>
        </dl>
      </header>

      <IndicatorCards stats={stats} />

      {dossier.timeline?.length ? (
        <Timeline
          items={dossier.timeline}
          title={dossier.timelineTitle}
          subtitle={dossier.timelineSubtitle}
        />
      ) : (
        <EmptySection
          title="How the present came about"
          lead="An interactive timeline of the events behind the region's current situation."
        />
      )}

      <ThematicEntries entries={withPlaceholders} />

      {dossier.visuals?.length ? (
        <VisualCarousel visuals={dossier.visuals} />
      ) : (
        <EmptySection
          title="Maps & charts"
          lead="A carousel of interactive infographics and maps for this region."
          rows={2}
        />
      )}

      {newsItems.length ? (
        <NewsTabs
          newsItems={newsItems.map((item) => ({
            slug: item.slug,
            title: item.title,
            summary: item.summary,
            category: item.category,
            hero: item.hero,
          }))}
        />
      ) : null}

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
          lead="The five questions people ask most often about this region."
          rows={3}
        />
      )}

      <PatronsCallout complete={complete} />

      <p className="px-6 pb-8 text-center text-[11.5px] text-[var(--color-ink-muted)] sm:px-10">
        <Link href="/" className="hover:underline">
          ← Back to the globe
        </Link>
      </p>
    </article>
  );
}

/** Kategorie novinek Atlasu na čtyři tematické skupiny ze zadání. */
function mapCategory(category: string): string {
  switch (category) {
    case "Living Conditions":
      return "Living Conditions";
    case "Society":
      return "Society";
    case "Political System":
    case "International Relations":
      return "Politics & International Relations";
    case "Historical Roots":
      return "Historical Roots";
    default:
      return "Society";
  }
}
