"use client";

import { usePathname } from "next/navigation";
import EncyclopediaDock from "@/components/EncyclopediaDock";
import { MAP_CONTROLS_LEFT, RAIL_OFFSET, isFullPage, isHome, railKind } from "@/config/layout";
import { cn } from "@/lib/cn";
import type { SubtopicTile } from "@/features/topics/featured";
import { FeaturedSubtopics } from "./FeaturedSubtopics";
import { IssueMenu, type IssueMenuItem } from "./IssueMenu";
import { useMapState } from "./MapContext";
import ModeSwitch from "./ModeSwitch";
import ViewSwitcher, { type ViewOption } from "./ViewSwitcher";

/**
 * Bar over the map, top right: countries/regions/global issues switcher, data
 * layer switcher and search; under them the latest subtopics (home), or the
 * global issues as tiles while that mode is on. When a
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
  /** Global issues on the map (tiles under the search in that mode). */
  issues: IssueMenuItem[];
  /** Subtopic tiles under the search field (home map only). */
  featured: SubtopicTile[];
}) {
  const pathname = usePathname();
  const { mode } = useMapState();
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
        // Never wider than the room between the zoom buttons and the panel: the
        // switches wrap instead of covering "+" / "−" (768–1024 px with a panel).
        MAP_CONTROLS_LEFT,
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
      <EncyclopediaDock />
      {/* Global issues mode: the issues as tiles in the place of the latest subtopics. */}
      {mode === "issue" && issues.length ? (
        <IssueMenu items={issues} />
      ) : isHome(pathname) ? (
        <FeaturedSubtopics items={featured} />
      ) : null}
    </div>
  );
}
