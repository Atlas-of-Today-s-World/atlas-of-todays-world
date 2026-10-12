"use client";

import { Minus, Pause, Plus, Rotate3d } from "lucide-react";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { cn } from "@/lib/cn";
import type { useIdleSpin } from "../useIdleSpin";

const CONTROL =
  "glass glass-hover pointer-events-auto flex size-(--touch-min) items-center justify-center rounded-[10px] text-white/90 transition focus-visible:ring-2 focus-visible:ring-white/70";

/** Zoom in / out and the idle spin's start / stop, top left over the globe (from `md` up). */
export function GlobeZoomControls({
  hidden,
  onZoomIn,
  onZoomOut,
  spin,
}: {
  hidden: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  spin: ReturnType<typeof useIdleSpin>;
}) {
  const t = useMessages();
  return (
    <div
      hidden={hidden}
      // Phones zoom with two fingers: the buttons would only crowd the controls there.
      className="pointer-events-none absolute top-24 left-5 hidden flex-col gap-1.5 md:flex"
    >
      <button type="button" aria-label={t.map.zoomIn} onClick={onZoomIn} className={CONTROL}>
        <Plus size={18} aria-hidden />
      </button>
      <button type="button" aria-label={t.map.zoomOut} onClick={onZoomOut} className={CONTROL}>
        <Minus size={18} aria-hidden />
      </button>
      {spin.available ? (
        // Start the rotation (with the pulsing topic counts) now, or stop it.
        <button
          type="button"
          aria-label={spin.spinning ? t.map.spinStop : t.map.spinStart}
          aria-pressed={spin.spinning}
          title={spin.spinning ? t.map.spinStop : t.map.spinStart}
          onClick={spin.toggle}
          className={cn(CONTROL, "mt-1.5 aria-pressed:text-white")}
        >
          {spin.spinning ? <Pause size={17} aria-hidden /> : <Rotate3d size={18} aria-hidden />}
        </button>
      ) : null}
    </div>
  );
}
