"use client";

import { usePathname } from "next/navigation";
import EncyclopediaDock from "@/components/EncyclopediaDock";
import ViewSwitcher, { type ViewOption } from "./ViewSwitcher";

/**
 * Lišta nad mapou vpravo nahoře: přepínač vrstev + Global Encyclopedia.
 * Když je otevřený profil regionu/země, odsune se doleva, aby ji bílý panel
 * nepřekrýval.
 */
export default function MapControls({ options }: { options: ViewOption[] }) {
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
        <ViewSwitcher options={options} />
      </div>
      <EncyclopediaDock />
    </div>
  );
}
