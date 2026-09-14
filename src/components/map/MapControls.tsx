"use client";

import { usePathname } from "next/navigation";
import EncyclopediaDock from "@/components/EncyclopediaDock";
import type { HotNewsItem } from "@/components/HotNews";
import ModeSwitch from "./ModeSwitch";
import ViewSwitcher, { type ViewOption } from "./ViewSwitcher";

/**
 * Lišta nad mapou vpravo nahoře: přepínač států/regionů, přepínač datových
 * vrstev, Global Encyclopedia a Hot News. Když je otevřený profil regionu nebo
 * země, odsune se doleva, aby ji bílý panel nepřekrýval.
 */
export default function MapControls({
  options,
  hotNews,
}: {
  options: ViewOption[];
  hotNews: HotNewsItem[];
}) {
  const pathname = usePathname();
  const wideRail = /^\/(entry|region\/[^/]+\/full)/.test(pathname);
  const railOpen = pathname !== "/";

  const offset = wideRail
    ? "right-5 md:right-[calc(min(52vw,46rem)+1.25rem)]"
    : railOpen
      ? "right-5 md:right-[calc(min(38vw,27rem)+1.25rem)]"
      : "right-5";

  return (
    <div
      className={`pointer-events-none absolute top-20 z-30 flex flex-col items-end gap-2.5 ${offset}`}
    >
      <div className="flex items-start gap-2.5">
        <ModeSwitch />
        <ViewSwitcher options={options} />
      </div>
      <EncyclopediaDock hotNews={hotNews} />
    </div>
  );
}
