import { ShareButton } from "@/components/atlas/ShareButton";
import Link from "@/components/i18n/Link";
import { TopicsLink } from "@/components/topics/RelatedTopics";
import type { EntrySummary } from "@/features/entries/queries";
import type { Country, CountryProfile } from "@/features/geography/types";
import { getRequestLocale, getT } from "@/features/i18n/request";
import { formatPopulation } from "@/lib/format";
import { PHOTO_WIDTH } from "@/lib/images";
import { cssBackgroundImage } from "@/lib/security/urls";
import { format } from "@/features/i18n/messages";
import { MetricCards, SourceLink, StatGrid, StatIcon, StatItem } from "./atlas/ui";
import { routes } from "@/config/routes";

/**
 * Country card after clicking the globe (Figma: "Country View").
 *
 * At the top: breadcrumbs to the region, name, description and indicators. The region
 * isn't just a text link somewhere at the bottom – it has its own card with image and button,
 * because that's the most common next step from a country profile.
 */
/** How the status is named in the country profile (text key in messages → country). */
const TERRITORY_STATUS_KEY = {
  disputed: "disputed",
  "non-self-governing": "nonSelfGoverning",
  occupied: "occupied",
} as const;

export default function CountryCard({
  country,
  newsItems,
  description,
  profile,
  topics,
}: {
  country: Country;
  newsItems: EntrySummary[];
  description: string;
  profile?: CountryProfile | null;
  /** Topics about the country (own, its region's, its groups') and the filtered list. */
  topics?: { items: EntrySummary[]; href: string };
}) {
  const t = getT();
  const region = country.region;

  /**
   * Editors can choose in the admin which automatic indicators are worth showing
   * for a country and in what order; without a choice the existing first six
   * remain. Unknown ids (a removed indicator) are silently skipped.
   */
  const featured = profile?.featured ?? [];
  const highlights = featured.length
    ? featured
        .map((id) => country.stats.find((stat) => stat.id === id))
        .filter((stat): stat is (typeof country.stats)[number] => Boolean(stat))
        .slice(0, 6)
    : country.stats.slice(0, 6);

  const metrics = profile?.metrics ?? [];

  return (
    <article className="px-6 pt-6 pb-10">
      {region ? (
        // pr-12: a long trail must not run under the panel's close button (×).
        <nav
          aria-label={t.ui.breadcrumb}
          className="pr-12 text-[12px] text-[var(--color-ink-muted)]"
        >
          <Link
            href={routes.region(region.slug)}
            // The hit area reaches above and below the small text (44 px row).
            className="relative font-medium text-[var(--color-link)] after:absolute after:inset-x-0 after:-inset-y-4 after:content-[''] hover:underline"
          >
            {region.name}
          </Link>
          <span aria-hidden className="px-1.5">
            ›
          </span>
          <span className="text-[var(--color-ink)]">{country.name}</span>
        </nav>
      ) : null}

      <h1 className="font-display mt-2 text-[26px] leading-tight font-bold text-[var(--color-ink)]">
        {country.name}
      </h1>

      {profile?.tagline ? (
        <p className="mt-1.5 text-[12.5px] leading-snug font-medium text-[var(--color-link)]">
          {profile.tagline}
        </p>
      ) : null}

      <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-soft)]">{description}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {topics ? <TopicsLink count={topics.items.length} href={topics.href} /> : null}
        <ShareButton title={country.name} />
      </div>

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
          <h2 className="text-[11px] font-medium tracking-[0.1em] text-[var(--color-ink-muted)] uppercase">
            {t.country.whereStands}
          </h2>
          <MetricCards metrics={metrics} className="mt-4" />
        </section>
      ) : null}

      {region ? (
        <Link
          href={routes.region(region.slug)}
          className="group mt-7 block overflow-hidden rounded-xl border border-[var(--color-line)] transition hover:border-[var(--color-accent)]"
        >
          <span
            className="block h-28 w-full bg-cover bg-center"
            style={{
              // Through cssBackgroundImage: an escaped, resized URL — and none at all
              // when the region has no photo (it used to request "url(null)").
              backgroundImage: [
                "linear-gradient(180deg, rgba(10,16,32,0.15), rgba(10,16,32,0.55))",
                cssBackgroundImage(region.hero, PHOTO_WIDTH.card),
              ]
                .filter(Boolean)
                .join(", "),
              backgroundColor: "var(--color-space)",
            }}
            role="img"
            aria-label={format(t.ui.fromOrbit, { name: region.name })}
          />
          <span className="block p-4">
            <span className="text-[10.5px] tracking-[0.1em] text-[var(--color-ink-muted)] uppercase">
              {t.country.region}
            </span>
            <span className="font-display mt-1 block text-[16px] font-bold text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
              {region.name}
            </span>
            <span className="mt-1.5 block text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
              {region.summary.split(". ")[0]}.
            </span>
            <span className="mt-3 inline-flex min-h-11 items-center text-[12.5px] font-medium text-[var(--color-link)]">
              {t.country.exploreRegion}
            </span>
          </span>
        </Link>
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
        <p className="mt-5 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-soft,#f6f7fb)] px-4 py-3 text-[12px] leading-relaxed text-[var(--color-ink-soft)]">
          <span className="font-medium text-[var(--color-ink)]">
            {
              t.country[
                TERRITORY_STATUS_KEY[
                  country.territoryNote.status as keyof typeof TERRITORY_STATUS_KEY
                ]
              ]
            }
          </span>{" "}
          {country.territoryNote.note}{" "}
          <span className="text-[var(--color-ink-muted)]">({country.territoryNote.basis})</span>
        </p>
      ) : null}

      {newsItems.length ? (
        <div className="mt-7">
          <h2 className="font-display text-[15px] font-bold text-[var(--color-ink)]">
            {format(t.countryCard.newsAbout, { name: country.name })}
          </h2>
          <ul className="mt-3 space-y-2">
            {newsItems.map((item) => (
              <li key={item.slug}>
                <Link
                  href={routes.news(item.slug)}
                  className="group block rounded-xl border border-[var(--color-line)] p-3 transition hover:border-[var(--color-accent)]"
                >
                  <span className="text-[10.5px] tracking-wide text-[var(--color-ink-muted)] uppercase">
                    {t.categories[item.category]}
                  </span>
                  <span className="mt-0.5 block text-[13.5px] font-medium text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-[12px] leading-snug text-[var(--color-ink-muted)]">
                    {item.summary}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
