"use client";

import { usePathname } from "next/navigation";
import EncyclopediaDock from "@/components/EncyclopediaDock";
import { RAIL_OFFSET, isFullPage, isHome, railKind } from "@/config/layout";
import { cn } from "@/lib/cn";
import ModeSwitch from "./ModeSwitch";
import ViewSwitcher, { type ViewOption } from "./ViewSwitcher";

/**
 * Bar over the map, top right: countries/regions switcher, data layer
 * switcher and search. When a region or country profile is
 * open, it moves left so the white panel doesn't cover it.
 */
export default function MapControls({
  options,
  hasIssues,
}: {
  options: ViewOption[];
  hasIssues: boolean;
}) {
  const pathname = usePathname();
  const rail = railKind(pathname);
  // Without the panel the bar keeps the same margin on mobile and desktop.
  const offset = rail === "none" ? "right-5" : `right-5 ${RAIL_OFFSET[rail]}`;
  // On full-width pages the globe is only a small window: no controls over it.
  if (isFullPage(pathname)) return null;

  return (
    <div
      data-print="hide"
      className={cn(
        "pointer-events-none absolute left-4 z-30 flex flex-col items-end gap-2.5 sm:left-auto",
        // Home: below the transparent header over the globe. Elsewhere the map
        // already starts under the dark bar (MapStage), so the controls sit right at its top.
        isHome(pathname) ? "top-16 sm:top-20" : "top-3",
        offset,
      )}
    >
      <div className="flex flex-wrap items-start justify-end gap-2.5">
        <ModeSwitch hasIssues={hasIssues} />
        <ViewSwitcher options={options} />
      </div>
      <EncyclopediaDock />
    </div>
  );
}
