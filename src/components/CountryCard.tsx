import { Breadcrumbs } from "@/components/atlas/Breadcrumbs";
import { kickerVariants } from "@/components/atlas/kicker";
import { ShareButton } from "@/components/atlas/ShareButton";
import Link from "@/components/i18n/Link";
import { TopicsLink } from "@/components/topics/RelatedTopics";
import type { EntrySummary } from "@/features/entries/types";
import type { Country, CountryProfile, CountryStat } from "@/features/geography/types";
import { getRequestLocale, getT } from "@/lib/i18n/request";
import { formatPopulation } from "@/lib/format";
import { format } from "@/lib/i18n/messages";
import { MetricCards, SourceLink, StatGrid, StatIcon, StatItem } from "./atlas/ui";
import { routes } from "@/config/routes";

/**
 * Country card after clicking the globe (Figma: "Country View").
 *
 * At the top: breadcrumbs to the region, name, description and indicators.
 *
 * The region used to get a teaser card here (photo, name, "Explore the region").
 * It was removed on 2026-10-16: the region's full profile now follows right
 * below the country (RegionalProfile), with its own photo header and a link to
 * the region's page, so the card only repeated what was a screen further down.
 * The way to the region stays in the breadcrumbs and in Subregion.
 */
/** How the status is named in the country profile (text key in messages → country). */
const TERRITORY_STATUS_KEY = {
  disputed: "disputed",
  "non-self-governing": "nonSelfGoverning",
  occupied: "occupied",
} as const;

export default async function CountryCard({
  country,
  stats,
  description,
  profile,
  topics,
}: {
  country: Country;
  /** The country's value in every data layer (`getCountryStats`). */
  stats: CountryStat[];
  description: string;
  profile?: CountryProfile | null;
  /** Topics about the country (own, its region's, its groups') and the filtered list. */
  topics?: { items: EntrySummary[]; href: string };
}) {
  const t = await getT();
  const region = country.region;

  /**
   * Editors can choose in the admin which automatic indicators are worth showing
   * for a country and in what order; without a choice the existing first six
   * remain. Unknown ids (a removed indicator) are silently skipped.
   */
  const featured = profile?.featured ?? [];
  const highlights = featured.length
    ? featured
        .map((id) => stats.find((stat) => stat.id === id))
        .filter((stat): stat is CountryStat => Boolean(stat))
        .slice(0, 6)
    : stats.slice(0, 6);

  const metrics = profile?.metrics ?? [];

  return (
    <article className="px-6 pt-6 pb-10">
      {/* The trail to the region and, at the right, sharing — both above the name.
          pr-12: neither may run under the panel's close button (×). */}
      <div className="flex flex-wrap items-center justify-between gap-2 pr-12">
        {region ? (
          <Breadcrumbs
            label={t.ui.breadcrumb}
            items={[
              { label: region.name, href: routes.region(region.slug) },
              { label: country.name, current: true },
            ]}
          />
        ) : (
          <span aria-hidden />
        )}
        <ShareButton title={country.name} className="ml-auto flex-row-reverse" />
      </div>

      <h1 className="font-display mt-2 text-[26px] leading-tight font-bold text-[var(--color-ink)]">
        {country.name}
      </h1>

      {profile?.tagline ? (
        <p className="mt-1.5 text-[12.5px] leading-snug font-medium text-[var(--color-link)]">
          {profile.tagline}
        </p>
      ) : null}

      <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-soft)]">{description}</p>
      {topics ? (
        <TopicsLink count={topics.items.length} href={topics.href} className="mt-4" />
      ) : null}

      <StatGrid className="mt-5">
        {highlights.map((stat) => (
          <StatItem
            key={stat.id}
            label={stat.label}
            value={stat.value}
            icon={<StatIcon id={stat.id} />}
          >
            {/* The rank opens the layer's ranking of all countries with this one picked. */}
            <Link
              href={routes.view(stat.id, country.iso3.toLowerCase())}
              className="text-[var(--color-link)] hover:underline"
            >
              {stat.rank
                ? format(t.countryCard.ranked, { rank: String(stat.rank), of: String(stat.rankOf) })
                : t.countryCard.allCountries}
            </Link>
            {stat.year}
            <br />
            <SourceLink href={stat.sourceUrl}>{stat.source}</SourceLink>
          </StatItem>
        ))}
      </StatGrid>

      {metrics.length ? (
        <section className="mt-7 border-t border-[var(--color-line)] pt-5">
          <h2 className={kickerVariants()}>{t.country.whereStands}</h2>
          <MetricCards metrics={metrics} className="mt-4" />
        </section>
      ) : null}

      <div className="mt-7 grid grid-cols-2 gap-4 border-t border-[var(--color-line)] pt-5 text-[12.5px]">
        <div>
          <span className="block text-[var(--color-ink-muted)]">{t.countryCard.population}</span>
          <span className="font-medium text-[var(--color-ink)]">
            {formatPopulation(country.population, getRequestLocale())}
          </span>
        </div>
        <div>
          <span className="block text-[var(--color-ink-muted)]">{t.countryCard.subregion}</span>
          <span className="font-medium text-[var(--color-ink)]">
            {country.unSubregion ?? "—"}
            {region ? (
              <>
                {" · "}
                <Link
                  href={routes.region(region.slug)}
                  className="font-normal text-[var(--color-link)] hover:underline"
                >
                  {region.name}
                </Link>
              </>
            ) : null}
          </span>
        </div>
      </div>

      {country.territoryNote ? (
        // Atlas draws borders according to UN practice. Where that differs from de facto
        // control, the profile must say why and on what basis – otherwise readers
        // take it as Atlas's own claim.
        <p className="mt-5 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-soft)] px-4 py-3 text-[12px] leading-relaxed text-[var(--color-ink-soft)]">
          {country.territoryNote.status ? (
            <>
              <span className="font-medium text-[var(--color-ink)]">
                {t.country[TERRITORY_STATUS_KEY[country.territoryNote.status]]}
              </span>{" "}
            </>
          ) : null}
          {country.territoryNote.note}
          {country.territoryNote.basis ? (
            <>
              {" "}
              <span className="text-[var(--color-ink-muted)]">({country.territoryNote.basis})</span>
            </>
          ) : null}
        </p>
      ) : null}
    </article>
  );
}
