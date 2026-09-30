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
      {count} {count === 1 ? "news item" : "news items"} published
    </span>
  );
}

/**
 * Ručně zadaný ukazatel na kartě – stejný tvar u země i u regionu.
 *
 * Automatické ukazatele z OWID mají ikonu a hodnocení pořadí; tyhle mají místo
 * toho větu vysvětlení, protože měří věci, které nejdou seřadit (etnické
 * skupiny, míra svobody). Zdroj je povinný, takže se vypisuje vždy.
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
    <dl className={`grid grid-cols-2 gap-x-5 gap-y-6 ${className}`}>
      {metrics.map((metric) => (
        <div key={`${metric.label}-${metric.value}`}>
          <span className="font-display block text-[21px] leading-none font-semibold text-[var(--color-ink)]">
            {metric.value}
          </span>
          <dt className="mt-2 text-[12.5px] leading-snug font-medium text-[var(--color-ink)]">
            {metric.label}
          </dt>
          <dd className="mt-1 text-[11px] leading-relaxed text-[var(--color-ink-muted)]">
            {metric.description ? <span className="block">{metric.description}</span> : null}
            <span className="mt-0.5 block">
              Source:{" "}
              {metric.sourceUrl ? (
                <a
                  href={metric.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--color-link)] hover:underline"
                >
                  {metric.source}
                </a>
              ) : (
                metric.source
              )}
              {metric.year ? `, ${metric.year}` : ""}
            </span>
          </dd>
        </div>
      ))}
    </dl>
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
