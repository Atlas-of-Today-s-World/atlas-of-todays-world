import Link from "next/link";
import { MetricCards, StatIcon } from "./atlas-ui";
import type { RegionStat } from "@/lib/region-stats";
import type { FaqItem, MetricCard, ResourceItem, TimelineItem } from "@/lib/content-types";

/**
 * Stavební díly portrétu. Používá je portrét regionu i portrét global issue –
 * zadání pro obojí popisuje stejné sekce, takže je nemá smysl psát dvakrát.
 *
 * Nenapsané sekce se nevynechávají: kreslí se šedivé a nekliknutelné, aby bylo
 * vidět, co Atlas plánuje, a hned u nich stojí výzva k podpoře.
 */

export const ENTRY_CATEGORIES = [
  "Living Conditions",
  "Society",
  "Politics & International Relations",
  "Historical Roots",
] as const;

/** Nadpis sekce; `muted` se používá u šedivých (zatím nenapsaných) částí. */
function SectionHead({
  title,
  lead,
  muted = false,
}: {
  title: string;
  lead?: string;
  muted?: boolean;
}) {
  return (
    <div>
      <h2
        className={`font-display text-[20px] font-bold ${
          muted ? "text-[var(--color-ink-muted)]" : "text-[var(--color-ink)]"
        }`}
      >
        {title}
      </h2>
      {lead ? (
        <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
          {lead}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Šedivá sekce pro obsah, který redakce zatím nenapsala. Nic uvnitř nereaguje
 * na klik (`pointer-events-none`), ať je hned jasné, že tady zatím nic není.
 */
export function EmptySection({
  title,
  lead,
  rows = 3,
  children,
}: {
  title: string;
  lead: string;
  rows?: number;
  children?: React.ReactNode;
}) {
  return (
    <section className="border-t border-[var(--color-line)] px-6 py-8 sm:px-10">
      <SectionHead title={title} lead={lead} muted />
      <div aria-hidden className="pointer-events-none mt-5 space-y-2 opacity-55 select-none">
        {children ?? (
          <>
            {Array.from({ length: rows }).map((_, index) => (
              <div
                key={index}
                className="h-16 rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-line)]/25"
              />
            ))}
          </>
        )}
      </div>
      <p className="mt-4 text-[12px] text-[var(--color-ink-muted)]">
        Not written yet.{" "}
        <Link href="/patrons" className="font-medium text-[var(--color-link)] hover:underline">
          Help Us Complete It By Joining Atlas Patrons →
        </Link>
      </p>
    </section>
  );
}

/**
 * Šest klíčových ukazatelů s citací zdroje.
 *
 * Když redakce zadala vlastní ukazatele (administrace → Regiony), mají
 * přednost: měří věci, které v Our World in Data nejsou — etnické skupiny,
 * vysídlení, dětskou chudobu. Bez nich se kreslí dopočet z importovaných dat,
 * aby portrét nebyl prázdný ani u regionu, ke kterému nikdo nic nenapsal.
 */
export function IndicatorCards({
  stats,
  metrics = [],
}: {
  stats: RegionStat[];
  metrics?: MetricCard[];
}) {
  if (metrics.length) {
    return (
      <section className="border-t border-[var(--color-line)] px-6 py-8 sm:px-10">
        <SectionHead
          title="Key indicators"
          lead="Picked by the Atlas team for this region, each with the source it comes from."
        />
        <MetricCards metrics={metrics} className="mt-5" />
      </section>
    );
  }

  if (!stats.length) return null;
  return (
    <section className="border-t border-[var(--color-line)] px-6 py-8 sm:px-10">
      <SectionHead
        title="Key indicators"
        lead="Population-weighted across the countries in this group. Categorical layers show the most common value."
      />
      <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-6">
        {stats.map((stat) => (
          <div key={stat.id}>
            <div className="flex items-center gap-2.5 text-[var(--color-ink)]">
              <StatIcon id={stat.id} />
              <span className="font-display text-[19px] leading-none font-semibold">
                {stat.value}
              </span>
            </div>
            <dt className="mt-2 text-[12.5px] font-medium text-[var(--color-ink)]">{stat.label}</dt>
            <dd className="mt-1 text-[11px] leading-relaxed text-[var(--color-ink-muted)]">
              {stat.coverage.have} of {stat.coverage.total} countries · {stat.year}
              <br />
              <a
                href={stat.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--color-link)] hover:underline"
              >
                {stat.source}
              </a>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Vodorovná časová osa. */
export function Timeline({
  items,
  title,
  subtitle,
}: {
  items: TimelineItem[];
  title?: string;
  subtitle?: string;
}) {
  return (
    <section className="border-t border-[var(--color-line)] px-6 py-8 sm:px-10">
      <SectionHead
        title={title ?? "How the present came about"}
        lead={subtitle ?? "The events that shaped the region's current situation."}
      />
      <div className="panel-scroll -mx-1 mt-6 flex snap-x gap-6 overflow-x-auto px-1 pb-3">
        {items.map((item) => (
          <div key={item.title} className="w-60 shrink-0 snap-start">
            <h3 className="font-display text-[14px] leading-snug font-bold text-[var(--color-ink)]">
              {item.title}
            </h3>
            <p className="mt-1 text-[11.5px] text-[var(--color-ink-muted)]">{item.date}</p>
            <div className="my-3 flex items-center">
              <span className="h-3 w-3 rounded-full bg-[var(--color-accent)]" />
              <span className="h-px flex-1 bg-[var(--color-line)]" />
            </div>
            <p className="text-[12.5px] leading-relaxed text-[var(--color-ink-soft)]">
              {item.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export interface PlannedEntry {
  title: string;
  category: string;
  slug: string | null;
}

/**
 * Čtyři tematické kategorie hesel. Nenapsaná hesla jsou šedivá a nekliknutelná;
 * podle zadání to platí i pro region, který už nějaká hesla má.
 */
export function ThematicEntries({ entries }: { entries: PlannedEntry[] }) {
  return (
    <section className="border-t border-[var(--color-line)] px-6 py-8 sm:px-10">
      <SectionHead
        title="Encyclopedic entries"
        lead="Long-form entries in four themes. Grey titles are planned but not written yet."
      />
      <div className="mt-5 space-y-5">
        {ENTRY_CATEGORIES.map((category) => {
          const group = entries.filter((entry) => entry.category === category);
          return (
            <div key={category}>
              <h3 className="text-[11px] font-medium tracking-[0.1em] text-[var(--color-ink-muted)] uppercase">
                {category}
              </h3>
              <div className="panel-scroll -mx-1 mt-2.5 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2">
                {group.length ? (
                  group.map((entry) =>
                    entry.slug ? (
                      <Link
                        key={entry.title}
                        href={`/news/${entry.slug}`}
                        className="w-56 shrink-0 snap-start rounded-xl border border-[var(--color-line)] p-3 text-[13px] leading-snug font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                      >
                        {entry.title}
                      </Link>
                    ) : (
                      <span
                        key={entry.title}
                        aria-disabled="true"
                        title="Not written yet"
                        className="pointer-events-none w-56 shrink-0 snap-start rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-line)]/20 p-3 text-[13px] leading-snug text-[var(--color-ink-muted)]"
                      >
                        {entry.title}
                      </span>
                    ),
                  )
                ) : (
                  <span className="text-[12px] text-[var(--color-ink-muted)]">
                    Nothing planned here yet.
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[12px] text-[var(--color-ink-muted)]">
        <Link href="/patrons" className="font-medium text-[var(--color-link)] hover:underline">
          Help Us Complete It By Joining Atlas Patrons →
        </Link>
      </p>
    </section>
  );
}

/** Karusel infografik a map. */
export function VisualCarousel({
  visuals,
}: {
  visuals: { title: string; image: string; caption: string }[];
}) {
  return (
    <section className="border-t border-[var(--color-line)] px-6 py-8 sm:px-10">
      <SectionHead
        title="Maps & charts"
        lead="Selected visualisations from organisations that track this region."
      />
      <div className="panel-scroll -mx-1 mt-5 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
        {visuals.map((visual) => (
          <figure key={visual.title} className="w-[22rem] shrink-0 snap-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={visual.image}
              alt={visual.title}
              loading="lazy"
              className="h-48 w-full rounded-xl object-cover"
            />
            <figcaption className="mt-2 text-[11px] text-[var(--color-ink-muted)]">
              {visual.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/** Databáze zdrojů třetích stran. */
export function ResourceLibrary({ resources }: { resources: ResourceItem[] }) {
  const categories = [...new Set(resources.map((item) => item.kind ?? "Further reading"))];
  return (
    <section className="border-t border-[var(--color-line)] bg-[var(--color-band)] px-6 py-8 text-white sm:px-10">
      <h2 className="font-display text-[20px] font-bold">Learn more elsewhere</h2>
      <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-white/65">
        Documentaries, lectures, reports and databases picked by the Atlas team for this group.
      </p>
      {categories.map((category) => (
        <div key={category} className="mt-5">
          <h3 className="text-[11px] font-medium tracking-[0.1em] text-white/55 uppercase">
            {category}
          </h3>
          <div className="panel-scroll -mx-1 mt-2.5 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
            {resources
              .filter((item) => (item.kind ?? "Further reading") === category)
              .map((resource) => (
                <a
                  key={resource.url}
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-52 shrink-0 snap-start overflow-hidden rounded-xl bg-white text-[var(--color-ink)] transition hover:ring-2 hover:ring-[var(--color-accent)]"
                >
                  {resource.image ? (
                    <span
                      className="block h-24 w-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${resource.image})` }}
                    />
                  ) : null}
                  <span className="block p-3">
                    <span className="font-display block text-[13px] leading-snug font-bold">
                      {resource.title}
                    </span>
                    <span className="mt-1 block text-[11px] text-[var(--color-ink-muted)]">
                      {resource.source}
                    </span>
                  </span>
                </a>
              ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/** Rozbalovací FAQ. */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <section className="border-t border-[var(--color-line)] px-6 py-8 sm:px-10">
      <SectionHead title="Common questions" />
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <details
            key={item.question}
            className="group rounded-xl border border-[var(--color-line)] px-4 py-3"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-medium text-[var(--color-ink)]">
              {item.question}
              <span
                aria-hidden
                className="text-[var(--color-ink-muted)] transition group-open:rotate-180"
              >
                ⌄
              </span>
            </summary>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-[var(--color-ink-soft)]">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** Výzva k podpoře na konci portrétu. */
export function PatronsCallout({ complete }: { complete: boolean }) {
  return (
    <section className="border-t border-[var(--color-line)] px-6 py-9 text-center sm:px-10">
      <h2 className="font-display text-[22px] font-bold text-[var(--color-ink)]">
        {complete ? "Together We Can Build a New Encyclopedia" : "This portrait is not finished"}
      </h2>
      <p className="mx-auto mt-2.5 max-w-lg text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
        {complete
          ? "Atlas Patrons fund the writing, the data work and the independence of this encyclopedia."
          : "The sections above are waiting for authors. Atlas Patrons pay for the research and the writing that fills them in."}
      </p>
      <div className="mt-6">
        <Link
          href="/patrons"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-accent)] px-7 text-[13px] font-medium text-white transition hover:bg-[var(--color-accent-strong)]"
        >
          Help Us Complete It By Joining Atlas Patrons
        </Link>
      </div>
    </section>
  );
}
