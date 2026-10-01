/**
 * Layout dimensions (ARCHITEKTURA 15.1). Single source for JS; the CSS variables
 * in globals.css (`--rail-width`, `--rail-width-wide`, `--touch-min`) must
 * match — layout.test.ts enforces it.
 */

import { splitLocale } from "@/features/i18n/config";

/** Right content panel: min(vw, rem). */
export const RAIL = { vw: 38, rem: 27 } as const;
/** Wide panel (region portrait, global issue, news item). */
export const RAIL_WIDE = { vw: 52, rem: 46 } as const;

/** From this width up the panel is on the right; below it, a bottom sheet (Tailwind `md`). */
export const DESKTOP_MIN_PX = 768;
/** Minimum touch target (WCAG 2.5.5). */
export const TOUCH_MIN_PX = 44;

const REM_PX = 16;
const WIDE_RAIL = /^\/(news|region|global-issue)\//;

export type RailKind = "none" | "normal" | "wide";

/** Which panel is open on the given path. */
export function railKind(pathname: string): RailKind {
  // The language prefix (/cs/…) does not affect the panel width.
  const { path } = splitLocale(pathname);
  if (path === "/") return "none";
  return WIDE_RAIL.test(path) ? "wide" : "normal";
}

/** Panel width in px for the given window (0 on mobile or without a panel). */
export function railWidthPx(kind: RailKind, viewportWidth: number): number {
  if (kind === "none" || viewportWidth < DESKTOP_MIN_PX) return 0;
  const size = kind === "wide" ? RAIL_WIDE : RAIL;
  return Math.min((viewportWidth * size.vw) / 100, size.rem * REM_PX);
}

/**
 * Offset of elements above the map from the right panel (Header, MapControls).
 * Classes are spelled out in full so Tailwind can find them.
 */
export const RAIL_OFFSET: Record<RailKind, string> = {
  none: "md:right-7",
  normal: "md:right-[calc(var(--rail-width)+1.25rem)]",
  wide: "md:right-[calc(var(--rail-width-wide)+1.25rem)]",
};
