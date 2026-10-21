"use client";

import { usePathname } from "next/navigation";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { isFullPage, railKind } from "@/config/layout";
import { cn } from "@/lib/cn";
import { PILL_ICONS } from "./global-issues";
import { useMapState } from "./MapContext";
import type { ViewOption } from "./ViewSwitcher";

/** An icon of the globe's pills (PILL_ICONS), as on the globe. */
function Icon({ paths, size }: { paths: readonly string[]; size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

const PILL = "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px";

/**
 * What the pairs of pills under the regions' and countries' names mean, bottom
 * left over the globe (Countries and Regions modes). The region pill: the
 * region's content done (green, check mark) or planned (amber, calendar); the
 * entries pill: the region's topics published out of its whole entry plan.
 * Gives way to the metric scale (MapLegend), which takes the same corner.
 */
export function PillLegend({ options }: { options: ViewOption[] }) {
  const t = useMessages();
  const { view, mode } = useMapState();
  const pathname = usePathname();
  const metric = options.find((item) => item.id === view)?.swatches.length;
  if (mode === "issue" || metric || isFullPage(pathname)) return null;
  // On phones an open panel (bottom sheet) covers the bottom of the map.
  const hidden = railKind(pathname) !== "none" && "max-md:hidden";

  return (
    <dl
      aria-label={t.map.legendPills}
      className={cn(
        "glass z-panel pointer-events-none absolute bottom-3.5 left-[42px] grid w-[min(calc(100vw-110px),21rem)] grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5 rounded-[10px] px-2.5 py-2 text-[11px] leading-snug text-white/85 sm:text-[12px]",
        hidden,
      )}
    >
      <dt className={cn(PILL, "bg-status-ready-text text-white")}>
        <span className="sr-only">{t.map.legendRegionLabel}</span>
        <Icon paths={PILL_ICONS.globe} size={12} />
        <Icon paths={PILL_ICONS.check} size={10} />
      </dt>
      <dd>{t.map.legendRegionDone}</dd>
      <dt className={cn(PILL, "bg-status-preparing-text text-white")}>
        <span className="sr-only">{t.map.legendRegionLabel}</span>
        <Icon paths={PILL_ICONS.globe} size={12} />
        <Icon paths={PILL_ICONS.calendar} size={10} />
      </dt>
      <dd>{t.map.legendRegionPlanned}</dd>
      <dt className={cn(PILL, "bg-white font-semibold text-ink-deep")}>
        <span className="sr-only">{t.map.legendEntriesLabel}</span>
        <Icon paths={PILL_ICONS.book} size={11} />
        7/10
      </dt>
      <dd>{t.map.legendEntries}</dd>
    </dl>
  );
}
