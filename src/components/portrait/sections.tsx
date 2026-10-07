import Link from "@/components/i18n/Link";
import type { ReactNode } from "react";
import { cva } from "class-variance-authority";
import { MetricCards, SourceLink, StatGrid, StatIcon, StatItem } from "@/components/atlas/ui";
import { Rail } from "@/components/atlas/Rail";
import { Accordion } from "@/components/atlas/Accordion";
import { buttonVariants } from "@/components/ui/button";
import type { RegionStat } from "@/lib/region-stats";
import type { FaqItem, MetricCard, ResourceItem, TimelineItem } from "@/lib/content-types";
import { cssBackgroundImage, safeUrl } from "@/lib/security/urls";
import { datawrapperChartUrl } from "@/lib/embeds";
import { DatawrapperChart } from "./DatawrapperChart";
import { PHOTO_WIDTH } from "@/lib/images";
import { format } from "@/features/i18n/messages";
import { MEMBERSHIP_PATH } from "@/features/membership/config";
import { getT } from "@/features/i18n/request";

/**
 * Portrait building blocks. Used by both the region portrait and the global issue
 * portrait – the brief describes the same sections for both, so no point writing them twice.
 *
 * Unwritten sections aren't skipped: they're drawn grey and non-clickable, so it's
 * visible what Atlas is planning, with a call for support right next to them.
 */

export const ENTRY_CATEGORIES = [
  "Living Conditions",
  "Society",
  "Politics & International Relations",
  "Historical Roots",
] as const;

const section = cva("border-t px-6 py-8 sm:px-10", {
  variants: {
    tone: {
      light: "border-[var(--color-line)]",
      dark: "border-[var(--color-line)] bg-[var(--color-band)] text-white",
    },
  },
  defaultVariants: { tone: "light" },
});

/** Wrapper for every portrait section: divider, padding, heading and lead text. */
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
  /** Grey heading for parts not written yet. */
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
  const t = getT();
  return (
    <Link href={MEMBERSHIP_PATH} className="font-medium text-[var(--color-link)] hover:underline">
      {t.portrait.patronsCta}
      {arrow ? " →" : ""}
    </Link>
  );
}

/**
 * Grey section for content the editors haven't written yet. Nothing inside reacts
 * to clicks (`pointer-events-none`), so it's immediately clear there's nothing here yet.
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
  const t = getT();
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
        {t.portrait.notWrittenYet}. <PatronsLink />
      </p>
    </PortraitSection>
  );
}

/**
 * Six key indicators with source citations.
 *
 * When the editors entered custom indicators, they take precedence: they measure things
 * that aren't in Our World in Data — ethnic groups, displacement, child poverty.
 * Without them, values computed from imported data are drawn so the portrait isn't empty.
 */
export function IndicatorCards({
  stats,
  metrics = [],
}: {
  stats: RegionStat[];
  metrics?: MetricCard[];
}) {
  const t = getT();
  if (metrics.length) {
    return (
      <PortraitSection title={t.portrait.keyIndicators} lead={t.portrait.keyIndicatorsManual}>
        <MetricCards metrics={metrics} className="mt-5" />
      </PortraitSection>
    );
  }

  if (!stats.length) return null;
  return (
    <PortraitSection title={t.portrait.keyIndicators} lead={t.portrait.keyIndicatorsComputed}>
      <StatGrid className="mt-5">
        {stats.map((stat) => (
          <StatItem
            key={stat.id}
            label={stat.label}
            value={stat.value}
            icon={<StatIcon id={stat.id} />}
          >
            {format(t.portrait.coverage, {
              have: String(stat.coverage.have),
              total: String(stat.coverage.total),
              year: String(stat.year),
            })}
            <br />
            <SourceLink href={stat.sourceUrl}>{stat.source}</SourceLink>
          </StatItem>
        ))}
      </StatGrid>
    </PortraitSection>
  );
}

/** Horizontal timeline. */
export function Timeline({
  items,
  title,
  subtitle,
}: {
  items: TimelineItem[];
  title?: string;
  subtitle?: string;
}) {
  const t = getT();
  return (
    <PortraitSection
      title={title || t.portrait.timeline}
      lead={subtitle || t.portrait.timelineLead}
    >
      <Rail label={t.portrait.timeline} gap="lg" className="mt-6">
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
 * Four topic categories of entries. Unwritten entries are grey and non-clickable;
 * per the brief this applies even to a portrait that already has some entries.
 */
export function ThematicEntries({ entries }: { entries: PlannedEntry[] }) {
  const t = getT();
  return (
    <PortraitSection title={t.portrait.entries} lead={t.portrait.entriesLead}>
      <div className="mt-5 space-y-5">
        {ENTRY_CATEGORIES.map((category) => {
          const group = entries.filter((entry) => entry.category === category);
          return (
            <div key={category}>
              <h3 className="text-[11px] font-medium tracking-[0.1em] text-[var(--color-ink-muted)] uppercase">
                {t.categories[category]}
              </h3>
              {group.length ? (
                <Rail label={t.categories[category]} gap="sm" layout="grid" className="mt-2.5">
                  {group.map((entry) =>
                    entry.slug ? (
                      <Link
                        key={entry.title}
                        href={`/topics/${entry.slug}`}
                        className="min-w-0 rounded-xl border border-[var(--color-line)] p-3 text-[13px] leading-snug font-medium break-words text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                      >
                        {entry.title}
                      </Link>
                    ) : (
                      <span
                        key={entry.title}
                        aria-disabled="true"
                        title={t.portrait.notWrittenYet}
                        className="pointer-events-none min-w-0 rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-line)]/20 p-3 text-[13px] leading-snug break-words text-[var(--color-ink-muted)]"
                      >
                        {entry.title}
                      </span>
                    ),
                  )}
                </Rail>
              ) : (
                <p className="mt-2.5 text-[12px] text-[var(--color-ink-muted)]">
                  {t.portrait.nothingPlanned}
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

/**
 * Carousel of infographics and maps: images, and interactive Datawrapper charts in our
 * own sandboxed iframe — the chart URL is checked again here, so only the one
 * allowed origin is ever framed whatever the database holds.
 */
export function VisualCarousel({
  visuals,
}: {
  visuals: { title: string; image: string; caption: string; provider?: string }[];
}) {
  const t = getT();
  const safe = visuals.flatMap((visual) => {
    const chart = visual.provider === "datawrapper";
    const image = chart ? datawrapperChartUrl(visual.image) : safeUrl(visual.image);
    return image ? [{ ...visual, image, chart }] : [];
  });
  return (
    <PortraitSection title={t.portrait.maps} lead={t.portrait.mapsLead}>
      <Rail label={t.portrait.maps}>
        {safe.map((visual, index) => (
          <figure
            key={`${index}-${visual.image}`}
            className={`${visual.chart ? "w-[30rem] max-w-[85vw]" : "w-[22rem] max-w-[80vw]"} shrink-0 snap-start`}
          >
            {visual.chart ? (
              <DatawrapperChart src={visual.image} title={visual.title} />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={visual.image}
                alt={visual.title}
                loading="lazy"
                className="h-48 w-full rounded-xl object-cover"
              />
            )}
            <figcaption className="mt-2 text-[11px] text-[var(--color-ink-muted)]">
              {visual.caption}
            </figcaption>
          </figure>
        ))}
      </Rail>
    </PortraitSection>
  );
}

/** Database of third-party sources. */
export function ResourceLibrary({ resources }: { resources: ResourceItem[] }) {
  const t = getT();
  const safe = resources.flatMap((item) => {
    const url = safeUrl(item.url);
    return url ? [{ ...item, url }] : [];
  });
  const categories = [...new Set(safe.map((item) => item.kind ?? t.portrait.furtherReading))];
  return (
    <PortraitSection title={t.portrait.learnMore} lead={t.portrait.learnMoreLead} tone="dark">
      {categories.map((category) => (
        <div key={category} className="mt-5">
          <h3 className="text-[11px] font-medium tracking-[0.1em] text-white/55 uppercase">
            {category}
          </h3>
          <Rail label={category} tone="dark" className="mt-2.5">
            {safe
              .filter((item) => (item.kind ?? t.portrait.furtherReading) === category)
              .map((resource) => {
                const image = cssBackgroundImage(resource.image, PHOTO_WIDTH.thumb);
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

/** Collapsible FAQ. */
export function FaqList({ items }: { items: FaqItem[] }) {
  const t = getT();
  return (
    <PortraitSection title={t.portrait.faq}>
      <div className="mt-4">
        <Accordion items={items} />
      </div>
    </PortraitSection>
  );
}

/** Call for support at the end of the portrait. */
export function PatronsCallout({ complete }: { complete: boolean }) {
  const t = getT();
  return (
    <section className="border-t border-[var(--color-line)] px-6 py-9 text-center sm:px-10">
      <h2 className="font-display text-[22px] font-bold text-[var(--color-ink)]">
        {complete ? t.portrait.patronsCompleteTitle : t.portrait.patronsTodoTitle}
      </h2>
      <p className="mx-auto mt-2.5 max-w-lg text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
        {complete ? t.portrait.patronsCompleteText : t.portrait.patronsTodoText}
      </p>
      <div className="mt-6">
        <Link href={MEMBERSHIP_PATH} className={buttonVariants({ className: "text-[13px]" })}>
          {t.portrait.patronsCta}
        </Link>
      </div>
    </section>
  );
}
