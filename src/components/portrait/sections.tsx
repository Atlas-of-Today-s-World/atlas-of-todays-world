import Link from "next/link";
import type { ReactNode } from "react";
import { cva } from "class-variance-authority";
import { MetricCards, SourceLink, StatGrid, StatIcon, StatItem } from "@/components/atlas/ui";
import { Rail } from "@/components/atlas/Rail";
import { buttonVariants } from "@/components/ui/button";
import type { RegionStat } from "@/lib/region-stats";
import type { FaqItem, MetricCard, ResourceItem, TimelineItem } from "@/lib/content-types";
import { cssBackgroundImage, safeUrl } from "@/lib/security/urls";

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

const PATRONS_CTA = "Help Us Complete It By Joining Atlas Patrons";

const section = cva("border-t px-6 py-8 sm:px-10", {
  variants: {
    tone: {
      light: "border-[var(--color-line)]",
      dark: "border-[var(--color-line)] bg-[var(--color-band)] text-white",
    },
  },
  defaultVariants: { tone: "light" },
});

/** Obal každé sekce portrétu: oddělovač, odsazení, nadpis a perex. */
export function PortraitSection({
  title,
  lead,
  muted = false,
  tone = "light",
  className,
  children,
}: {
  title: string;
  lead?: string;
  /** Šedivý nadpis u zatím nenapsaných částí. */
  muted?: boolean;
  tone?: "light" | "dark";
  className?: string;
  children?: ReactNode;
}) {
  const dark = tone === "dark";
  return (
    <section className={section({ tone, className })}>
      <h2
        className={`font-display text-[20px] font-bold ${
          dark ? "" : muted ? "text-[var(--color-ink-muted)]" : "text-[var(--color-ink)]"
        }`}
      >
        {title}
      </h2>
      {lead ? (
        <p
          className={`mt-2 max-w-2xl text-[12.5px] leading-relaxed ${
            dark ? "text-white/65" : "text-[var(--color-ink-muted)]"
          }`}
        >
          {lead}
        </p>
      ) : null}
      {children}
    </section>
  );
}

function PatronsLink({ arrow = true }: { arrow?: boolean }) {
  return (
    <Link href="/patrons" className="font-medium text-[var(--color-link)] hover:underline">
      {PATRONS_CTA}
      {arrow ? " →" : ""}
    </Link>
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
}: {
  title: string;
  lead: string;
  rows?: number;
}) {
  return (
    <PortraitSection title={title} lead={lead} muted>
      <div aria-hidden className="pointer-events-none mt-5 space-y-2 opacity-55 select-none">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="h-16 rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-line)]/25"
          />
        ))}
      </div>
      <p className="mt-4 text-[12px] text-[var(--color-ink-muted)]">
        Not written yet. <PatronsLink />
      </p>
    </PortraitSection>
  );
}

/**
 * Šest klíčových ukazatelů s citací zdroje.
 *
 * Když redakce zadala vlastní ukazatele, mají přednost: měří věci, které
 * v Our World in Data nejsou — etnické skupiny, vysídlení, dětskou chudobu.
 * Bez nich se kreslí dopočet z importovaných dat, aby portrét nebyl prázdný.
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
      <PortraitSection
        title="Key indicators"
        lead="Picked by the Atlas team, each with the source it comes from."
      >
        <MetricCards metrics={metrics} className="mt-5" />
      </PortraitSection>
    );
  }

  if (!stats.length) return null;
  return (
    <PortraitSection
      title="Key indicators"
      lead="Population-weighted across the countries in this group. Categorical layers show the most common value."
    >
      <StatGrid className="mt-5">
        {stats.map((stat) => (
          <StatItem
            key={stat.id}
            label={stat.label}
            value={stat.value}
            icon={<StatIcon id={stat.id} />}
          >
            {stat.coverage.have} of {stat.coverage.total} countries · {stat.year}
            <br />
            <SourceLink href={stat.sourceUrl}>{stat.source}</SourceLink>
          </StatItem>
        ))}
      </StatGrid>
    </PortraitSection>
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
    <PortraitSection
      title={title || "How the present came about"}
      lead={subtitle || "The events that shaped the current situation."}
    >
      <Rail label="Timeline" gap="lg" className="mt-6">
        {items.map((item) => (
          <div key={`${item.date}-${item.title}`} className="w-60 shrink-0 snap-start">
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
      </Rail>
    </PortraitSection>
  );
}

export interface PlannedEntry {
  title: string;
  category: string;
  slug: string | null;
}

/**
 * Čtyři tematické kategorie hesel. Nenapsaná hesla jsou šedivá a nekliknutelná;
 * podle zadání to platí i pro portrét, který už nějaká hesla má.
 */
export function ThematicEntries({ entries }: { entries: PlannedEntry[] }) {
  return (
    <PortraitSection
      title="Encyclopedic entries"
      lead="Long-form entries in four themes. Grey titles are planned but not written yet."
    >
      <div className="mt-5 space-y-5">
        {ENTRY_CATEGORIES.map((category) => {
          const group = entries.filter((entry) => entry.category === category);
          return (
            <div key={category}>
              <h3 className="text-[11px] font-medium tracking-[0.1em] text-[var(--color-ink-muted)] uppercase">
                {category}
              </h3>
              {group.length ? (
                <Rail label={category} gap="sm" className="mt-2.5">
                  {group.map((entry) =>
                    entry.slug ? (
                      <Link
                        key={entry.title}
                        href={`/entry/${entry.slug}`}
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
                  )}
                </Rail>
              ) : (
                <p className="mt-2.5 text-[12px] text-[var(--color-ink-muted)]">
                  Nothing planned here yet.
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[12px] text-[var(--color-ink-muted)]">
        <PatronsLink />
      </p>
    </PortraitSection>
  );
}

/** Karusel infografik a map. */
export function VisualCarousel({
  visuals,
}: {
  visuals: { title: string; image: string; caption: string }[];
}) {
  const safe = visuals.flatMap((visual) => {
    const image = safeUrl(visual.image);
    return image ? [{ ...visual, image }] : [];
  });
  return (
    <PortraitSection
      title="Maps & charts"
      lead="Selected visualisations from organisations that track this part of the world."
    >
      <Rail label="Maps and charts">
        {safe.map((visual) => (
          <figure key={visual.title} className="w-[22rem] max-w-[80vw] shrink-0 snap-start">
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
      </Rail>
    </PortraitSection>
  );
}

/** Databáze zdrojů třetích stran. */
export function ResourceLibrary({ resources }: { resources: ResourceItem[] }) {
  const safe = resources.flatMap((item) => {
    const url = safeUrl(item.url);
    return url ? [{ ...item, url }] : [];
  });
  const categories = [...new Set(safe.map((item) => item.kind ?? "Further reading"))];
  return (
    <PortraitSection
      title="Learn more elsewhere"
      lead="Documentaries, lectures, reports and databases picked by the Atlas team."
      tone="dark"
    >
      {categories.map((category) => (
        <div key={category} className="mt-5">
          <h3 className="text-[11px] font-medium tracking-[0.1em] text-white/55 uppercase">
            {category}
          </h3>
          <Rail label={category} tone="dark" className="mt-2.5">
            {safe
              .filter((item) => (item.kind ?? "Further reading") === category)
              .map((resource) => {
                const image = cssBackgroundImage(resource.image);
                return (
                  <a
                    key={resource.url}
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-52 shrink-0 snap-start overflow-hidden rounded-xl bg-white text-[var(--color-ink)] transition hover:ring-2 hover:ring-[var(--color-accent)]"
                  >
                    {image ? (
                      <span
                        className="block h-24 w-full bg-cover bg-center"
                        style={{ backgroundImage: image }}
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
                );
              })}
          </Rail>
        </div>
      ))}
    </PortraitSection>
  );
}

/** Rozbalovací FAQ. */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <PortraitSection title="Common questions">
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
    </PortraitSection>
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
        <Link href="/patrons" className={buttonVariants({ className: "text-[13px]" })}>
          {PATRONS_CTA}
        </Link>
      </div>
    </section>
  );
}
