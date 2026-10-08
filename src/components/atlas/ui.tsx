import type { ReactNode } from "react";
import {
  BarChart3,
  CircleAlert,
  CircleDollarSign,
  Cloud,
  Globe,
  Heart,
  Landmark,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { MetricCard } from "@/lib/content-types";
import { safeUrl } from "@/lib/security/urls";
import { format } from "@/features/i18n/messages";
import { getT } from "@/features/i18n/request";
import { cn } from "@/lib/cn";

/** A value that reads as a figure ("0.564", "$4,579", "12/100"), not as words. */
const isFigure = (value: ReactNode) => typeof value !== "string" || /^[\d$€£−+—-]/.test(value);

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-[#1b2233] px-3 py-1 text-[10.5px] font-medium tracking-[0.12em] text-white/85 uppercase">
      {children}
    </span>
  );
}

export function NewsBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-ink-muted)]">
      <span className="h-2 w-2 rounded-full bg-[var(--color-live)]" />
      {format(count === 1 ? getT().ui.newsOne : getT().ui.newsMany, { count: String(count) })}
    </span>
  );
}

/** Grid of indicator cards (one <dl> for both the country card and the portrait). */
export function StatGrid({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <dl className={`grid grid-cols-2 gap-x-5 gap-y-6 ${className}`}>{children}</dl>;
}

/**
 * A single indicator card. Visually the value is on top, but in the DOM the name
 * (dt) comes first — a valid <dl>, so a screen reader reads "name: value" (WCAG 1.3.1).
 */
export function StatItem({
  label,
  value,
  icon,
  children,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <dt className="order-2 mt-2 text-[12.5px] leading-snug font-medium text-[var(--color-ink)]">
        {label}
      </dt>
      <dd className="order-1 flex items-center gap-2.5 text-[var(--color-ink)]">
        {icon ? <span className="flex shrink-0">{icon}</span> : null}
        {/* A category ("Electoral autocracy") is words, not a figure: smaller, so
            it wraps less and never squeezes the icon. */}
        <span
          className={cn(
            "font-display min-w-0 font-semibold",
            isFigure(value) ? "text-[21px] leading-none" : "text-[16px] leading-snug",
          )}
        >
          {value}
        </span>
      </dd>
      {children ? (
        <dd className="order-3 mt-1 text-[11px] leading-relaxed text-[var(--color-ink-muted)]">
          {children}
        </dd>
      ) : null}
    </div>
  );
}

/** Link to the figure's source (https only; without a URL just the name). */
export function SourceLink({ href, children }: { href?: string | null; children: ReactNode }) {
  const url = safeUrl(href);
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      // At least 24 px tall, so stacked source links stay easy to tap (WCAG 2.5.8).
      className="inline-flex min-h-6 items-center text-[var(--color-link)] hover:underline"
    >
      {children}
    </a>
  ) : (
    <>{children}</>
  );
}

/**
 * Manually entered indicator on a card – same shape for countries and regions.
 *
 * Automatic OWID indicators have an icon and a rank rating; these instead have
 * an explanatory sentence, because they measure things that can't be ranked (ethnic
 * groups, degree of freedom). The source is mandatory, so it's always shown.
 */
export function MetricCards({
  metrics,
  className = "",
}: {
  metrics: MetricCard[];
  className?: string;
}) {
  if (!metrics.length) return null;
  return (
    <StatGrid className={className}>
      {metrics.map((metric) => (
        <StatItem key={`${metric.label}-${metric.value}`} label={metric.label} value={metric.value}>
          {metric.description ? <span className="block">{metric.description}</span> : null}
          <span className="mt-0.5 block">
            {getT().ui.source} <SourceLink href={metric.sourceUrl}>{metric.source}</SourceLink>
            {metric.year ? `, ${metric.year}` : ""}
          </span>
        </StatItem>
      ))}
    </StatGrid>
  );
}

const STAT_ICONS: Record<string, LucideIcon> = {
  hdi: BarChart3,
  "life-expectancy": Heart,
  "gdp-per-capita": CircleDollarSign,
  "political-regime": Landmark,
  "democracy-index": Landmark,
  corruption: ShieldCheck,
  "extreme-poverty": UserRound,
  "co2-per-capita": Cloud,
  "internet-users": Globe,
};

export function StatIcon({ id }: { id: string }) {
  const Icon = STAT_ICONS[id] ?? CircleAlert;
  return <Icon size={22} strokeWidth={1.6} aria-hidden />;
}
