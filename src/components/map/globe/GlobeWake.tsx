"use client";

import { Globe2 } from "lucide-react";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { GLOBE_WAKE_MOBILE } from "@/config/layout";
import { cn } from "@/lib/cn";

/**
 * On a phone with a panel open the globe waits for the visitor (globe/startGate):
 * the bottom sheet covers most of it, and its ~1 MB library would otherwise hold
 * up the page being read. This button over the placeholder sphere starts it —
 * as does any tap on the map above the sheet. A browser drawing WebGL in
 * software (`everywhere`, globe/lowPower) waits the same way on every screen
 * size: on phones the button keeps its place above the sheet, on wider screens
 * it sits in the middle of the sphere.
 */
export function GlobeWake({
  onWake,
  everywhere = false,
}: {
  onWake: () => void;
  everywhere?: boolean;
}) {
  const t = useMessages();
  return (
    <button
      type="button"
      onClick={onWake}
      className={cn(
        "glass absolute left-1/2 inline-flex min-h-(--touch-min) -translate-x-1/2 items-center gap-2 rounded-full px-4 text-[13px] font-medium text-white transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
        GLOBE_WAKE_MOBILE,
        everywhere ? "md:top-1/2 md:bottom-auto md:-translate-y-1/2" : "md:hidden",
      )}
    >
      <Globe2 aria-hidden className="size-4" />
      {t.map.globeWake}
    </button>
  );
}
