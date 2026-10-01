"use client";

import { usePathname } from "next/navigation";
import EncyclopediaDock from "@/components/EncyclopediaDock";
import { RAIL_OFFSET, railKind } from "@/config/layout";
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
  const rail = railKind(pathname);
  // Bez panelu drží lišta stejný okraj na mobilu i desktopu.
  const offset = rail === "none" ? "right-5" : `right-5 ${RAIL_OFFSET[rail]}`;

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
