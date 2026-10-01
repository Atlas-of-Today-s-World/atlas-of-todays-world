"use client";

import { usePathname } from "next/navigation";
import EncyclopediaDock from "@/components/EncyclopediaDock";
import { RAIL_OFFSET, railKind } from "@/config/layout";
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

  return (
    <div
      data-print="hide"
      className={`pointer-events-none absolute top-16 left-4 z-30 flex flex-col items-end gap-2.5 sm:top-20 sm:left-auto ${offset}`}
    >
      <div className="flex flex-wrap items-start justify-end gap-2.5">
        <ModeSwitch hasIssues={hasIssues} />
        <ViewSwitcher options={options} />
      </div>
      <EncyclopediaDock />
    </div>
  );
}
