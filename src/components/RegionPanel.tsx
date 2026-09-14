import Link from "next/link";
import type { Region } from "@/data/regions";
import type { Country } from "@/lib/countries";
import type { Entry } from "@/lib/content";
import { EntriesBadge, PrimaryButton, TaglinePill, GhostButton } from "./atlas-ui";

/**
 * Zmenšený portrét regionu v pravém panelu mapy (Figma: "Main HP 2 / Region View").
 */
export default function RegionPanel({
  region,
  countries,
  entries,
}: {
  region: Region;
  countries: Country[];
  entries: Entry[];
}) {
  return (
    <article>
      <div
        className="h-44 w-full bg-cover bg-center"
        style={{ backgroundImage: `url(${region.hero})` }}
        role="img"
        aria-label={`${region.name} seen from orbit`}
      />

      <div className="px-6 pb-10 pt-6 text-center">
        <TaglinePill>{region.tagline}</TaglinePill>

        <h1 className="mt-4 font-display text-[27px] leading-tight font-bold text-[var(--color-ink)]">
          {region.name}
        </h1>

        <div className="mt-3">
          <EntriesBadge count={entries.length} />
        </div>

        <div className="mt-4">
          {entries.length ? (
            <PrimaryButton href={`/region/${region.slug}/full`}>
              Open the full portrait
            </PrimaryButton>
          ) : (
            <PrimaryButton href="/support">Join us to help complete it!</PrimaryButton>
          )}
        </div>

        <p className="mt-5 text-left text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
          {region.summary}
        </p>

        {entries.length ? (
          <div className="mt-7 text-left">
            <h2 className="font-display text-[15px] font-bold text-[var(--color-ink)]">
              Our entries
            </h2>
            <ul className="mt-3 space-y-2">
              {entries.slice(0, 5).map((entry) => (
                <li key={entry.slug}>
                  <Link
                    href={`/entry/${entry.slug}`}
                    className="group block rounded-xl border border-[var(--color-line)] p-3 transition hover:border-[var(--color-accent)]"
                  >
                    <span className="text-[10.5px] uppercase tracking-wide text-[var(--color-ink-muted)]">
                      {entry.category}
                    </span>
                    <span className="mt-0.5 block text-[13.5px] font-medium text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
                      {entry.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-7 text-left">
          <h2 className="font-display text-[15px] font-bold text-[var(--color-ink)]">
            Countries in this region
          </h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {countries.map((country) => (
              <Link
                key={country.iso3}
                href={`/country/${country.slug}`}
                className="rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[12px] text-[var(--color-ink-soft)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              >
                {country.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <GhostButton href={`/region/${region.slug}/full`}>
            Full portrait, timeline &amp; sources
          </GhostButton>
        </div>
      </div>
    </article>
  );
}
