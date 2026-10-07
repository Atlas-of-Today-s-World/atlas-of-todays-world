"use client";

import { usePathname } from "next/navigation";
import EncyclopediaDock from "@/components/EncyclopediaDock";
import { RAIL_OFFSET, isFullPage, isHome, railKind } from "@/config/layout";
import { cn } from "@/lib/cn";
import type { SubtopicTile } from "@/features/topics/featured";
import { FeaturedSubtopics } from "./FeaturedSubtopics";
import { IssueMenu, type IssueMenuItem } from "./IssueMenu";
import ModeSwitch from "./ModeSwitch";
import ViewSwitcher, { type ViewOption } from "./ViewSwitcher";

/**
 * Bar over the map, top right: countries/regions/global issues switcher (with
 * the list of issues in that mode), data layer switcher and search. When a
 * region or country profile is open, it moves left so the white panel doesn't cover it. On phones the bar
 * spans the width (switches on one row, search under them) and steps aside
 * while a panel is open: the bottom sheet needs the room, the globe above it
 * shows the place.
 */
export default function MapControls({
  options,
  issues,
  featured,
}: {
  options: ViewOption[];
  /** Global issues on the map (listed under the switch in that mode). */
  issues: IssueMenuItem[];
  /** Subtopic tiles under the search field (home map only). */
  featured: SubtopicTile[];
}) {
  const pathname = usePathname();
  const rail = railKind(pathname);
  // Without the panel the bar keeps the same margin on mobile and desktop.
  const offset = rail === "none" ? "right-4 sm:right-5" : `right-4 sm:right-5 ${RAIL_OFFSET[rail]}`;
  // On full-width pages the globe is only a small window: no controls over it.
  if (isFullPage(pathname)) return null;

  return (
    <div
      data-print="hide"
      className={cn(
        "pointer-events-none absolute left-4 z-30 flex flex-col items-stretch gap-2.5 sm:left-auto sm:items-end",
        rail !== "none" && "max-md:hidden",
        // Home: below the transparent header over the globe. Elsewhere the map
        // already starts under the dark bar (MapStage), so the controls sit right at its top.
        isHome(pathname) ? "top-16 sm:top-20" : "top-3",
        offset,
      )}
    >
      <div className="flex items-start justify-between gap-2 sm:flex-wrap sm:justify-end sm:gap-2.5">
        <ModeSwitch hasIssues={issues.length > 0} />
        <ViewSwitcher options={options} />
      </div>
      <IssueMenu items={issues} />
      <EncyclopediaDock />
      {isHome(pathname) ? <FeaturedSubtopics items={featured} /> : null}
    </div>
  );
}
