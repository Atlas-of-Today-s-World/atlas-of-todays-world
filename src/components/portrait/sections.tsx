import Link from "@/components/i18n/Link";
import type { ReactNode } from "react";
import { cva } from "class-variance-authority";
import { SourceLink, StatGrid, StatIcon, StatItem } from "@/components/atlas/ui";
import { Rail } from "@/components/atlas/Rail";
import { Accordion } from "@/components/atlas/Accordion";
import { PhotoCard } from "@/components/atlas/PhotoCard";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { RegionStat } from "@/features/geography/region-stats";
import type { FaqItem, MetricCard, ResourceItem } from "@/lib/content-types";
import { safeUrl } from "@/lib/security/urls";
import { PHOTO_WIDTH } from "@/lib/images";
import { format } from "@/lib/i18n/messages";
import { getT } from "@/lib/i18n/request";
import { routes } from "@/config/routes";

/**
 * Portrait building blocks. Used by both the region portrait and the global issue
 * portrait – the brief describes the same sections for both, so no point writing them twice.
 *
 * Unwritten sections aren't skipped: they're drawn grey and non-clickable, so it's
 * visible what Atlas is planning, with a call for support right next to them.
 */

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

/**
 * The support call as a button in the patrons colour. The site is used for
 * fundraising first: wherever content is missing, this is what should catch the eye.
 */
async function PatronsButton() {
  const t = await getT();
  return (
    <Link
      href={routes.membership}
      className="inline-flex min-h-(--touch-min) items-center gap-1.5 rounded-full bg-[var(--color-patron)] px-4 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-[var(--color-patron-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-patron)] focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {t.portrait.patronsCta} →
    </Link>
  );
}

/**
 * The parts of a portrait the editors haven't written yet, together in one quiet
 * section at the end — instead of a grey placeholder for each (they read like a
 * page still loading and pushed the real content down).
 */
export async function ComingSections({ items }: { items: { title: string; lead: string }[] }) {
  const t = await getT();
  if (!items.length) return null;
  return (
    <PortraitSection title={t.portrait.comingTitle} lead={t.portrait.comingLead} muted>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.title} className="text-[13px] leading-relaxed">
            <span className="font-medium text-[var(--color-ink)]">{item.title}</span>
            <span className="text-[var(--color-ink-muted)]"> — {item.lead}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5">
        <PatronsButton />
      </div>
    </PortraitSection>
  );
}

/**
 * Six key indicators with source citations.
 *
 * When the editors entered custom indicators (key facts), they take precedence: they
 * measure things that aren't in Our World in Data — ethnic groups, displacement, child
 * poverty — and are drawn as cards like on the original site. Without them, values
 * computed from imported data are drawn so the portrait isn't empty — only where the
 * caller passes them (a global issue; a region never shows computed averages).
 */
export async function IndicatorCards({
  stats = [],
  metrics = [],
}: {
  stats?: RegionStat[];
  metrics?: MetricCard[];
}) {
  const t = await getT();
  if (metrics.length) {
    return (
      <PortraitSection title={t.portrait.keyIndicators} lead={t.portrait.keyIndicatorsManual}>
        <KeyFactCards metrics={metrics} />
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

/**
 * Editorial key facts as cards, like the original site's number cards: the big
 * value, what it counts, the sentence explaining it and "Source: …" (a card
 * without a source is never published). One <dl> per card keeps name and value
 * together for screen readers, like StatItem.
 */
async function KeyFactCards({ metrics }: { metrics: MetricCard[] }) {
  const t = await getT();
  return (
    <ul className="mt-5 grid gap-3 sm:grid-cols-2">
      {metrics.map((metric) => (
        <li
          key={`${metric.label}-${metric.value}`}
          className="rounded-2xl border border-[var(--color-line)] bg-white p-5"
        >
          <dl className="flex h-full flex-col">
            <dt className="order-2 mt-2 text-[14px] leading-snug font-semibold text-[var(--color-ink)]">
              {metric.label}
            </dt>
            <dd className="font-display order-1 text-[34px] leading-none font-bold text-[var(--color-accent)]">
              {metric.value}
            </dd>
            {metric.description ? (
              <dd className="order-3 mt-2 text-[12.5px] leading-relaxed text-[var(--color-ink-soft)]">
                {metric.description}
              </dd>
            ) : null}
            <dd className="order-4 mt-auto pt-3 text-[11.5px] text-[var(--color-ink-muted)]">
              {t.ui.source} <SourceLink href={metric.sourceUrl}>{metric.source}</SourceLink>
              {metric.year ? `, ${metric.year}` : ""}
            </dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}

/** Database of third-party sources. */
export async function ResourceLibrary({ resources }: { resources: ResourceItem[] }) {
  const t = await getT();
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
              .map((resource) => (
                <PhotoCard
                  key={resource.url}
                  href={resource.url}
                  external
                  size="sm"
                  image={resource.image}
                  width={PHOTO_WIDTH.thumb}
                  // No preview from the source: the category as a calm header, so the row stays visual.
                  placeholder={category}
                  title={resource.title}
                  description={resource.source}
                />
              ))}
          </Rail>
        </div>
      ))}
    </PortraitSection>
  );
}

/** Collapsible FAQ. */
export async function FaqList({ items }: { items: FaqItem[] }) {
  const t = await getT();
  return (
    <PortraitSection title={t.portrait.faq}>
      <div className="mt-4">
        <Accordion items={items} />
      </div>
    </PortraitSection>
  );
}

/** Call for support at the end of the portrait. */
export async function PatronsCallout({ complete }: { complete: boolean }) {
  const t = await getT();
  return (
    <section className="border-t border-[var(--color-line)] px-6 py-9 text-center sm:px-10">
      <h2 className="font-display text-[22px] font-bold text-[var(--color-ink)]">
        {complete ? t.portrait.patronsCompleteTitle : t.portrait.patronsTodoTitle}
      </h2>
      <p className="mx-auto mt-2.5 max-w-lg text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
        {complete ? t.portrait.patronsCompleteText : t.portrait.patronsTodoText}
      </p>
      <div className="mt-6">
        {/* Patron colour (it leads to Atlas Patrons); may wrap on a narrow phone. */}
        <Link
          href={routes.membership}
          className={cn(
            buttonVariants({ variant: "patron" }),
            "max-w-full py-2.5 text-center text-[13px] leading-snug whitespace-normal",
          )}
        >
          {t.portrait.patronsCta}
        </Link>
      </div>
    </section>
  );
}
