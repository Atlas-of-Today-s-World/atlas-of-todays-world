"use client";

import { usePathname } from "next/navigation";
import EncyclopediaDock from "@/components/EncyclopediaDock";
import ModeSwitch from "./ModeSwitch";
import ViewSwitcher, { type ViewOption } from "./ViewSwitcher";

/**
 * Lišta nad mapou vpravo nahoře: přepínač států/regionů, přepínač datových
 * vrstev a vyhledávání. Když je otevřený profil regionu nebo
 * země, odsune se doleva, aby ji bílý panel nepřekrýval.
 */
export default function MapControls({
  options,
  hasIssues,
}: {
  options: ViewOption[];
  hasIssues: boolean;
}) {
  const pathname = usePathname();
  const wideRail = /^\/(news|region|global-issue)\//.test(pathname);
  const railOpen = pathname !== "/";

  const offset = wideRail
    ? "right-5 md:right-[calc(min(52vw,46rem)+1.25rem)]"
    : railOpen
      ? "right-5 md:right-[calc(min(38vw,27rem)+1.25rem)]"
      : "right-5";

  return (
    <div
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
