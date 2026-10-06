/**
 * Layout dimensions (ARCHITEKTURA 15.1). Single source for JS; the CSS variables
 * in globals.css (`--rail-width`, `--rail-width-wide`, `--touch-min`) must
 * match — layout.test.ts enforces it.
 */

import { splitLocale, withoutDefaultPrefix } from "@/features/i18n/config";

/** Right content panel: min(vw, rem). */
export const RAIL = { vw: 38, rem: 27 } as const;
/** Wide panel (region portrait, global issue, news item). */
export const RAIL_WIDE = { vw: 52, rem: 46 } as const;

/** Globe window bottom left on full-width pages, in px (larger from Tailwind `sm` up). */
export const MINI_GLOBE = {
  mobile: { width: 200, height: 132 },
  desktop: { width: 280, height: 180 },
  desktopMinPx: 640,
} as const;

/** From this width up the panel is on the right; below it, a bottom sheet (Tailwind `md`). */
export const DESKTOP_MIN_PX = 768;
/**
 * Mobile bottom sheet (ContentRail): the share of the window it takes when it
 * opens, so the place stays visible on the strip of globe above it (the camera
 * pads by the same share). Tapped or swiped up, it grows to nearly full height.
 */
export const MOBILE_SHEET = {
  ratio: 0.58,
  className: "max-h-[58dvh]",
  scrollClassName: "max-h-[calc(58dvh-2.75rem)]",
  expandedClassName: "max-h-[calc(100dvh-5.5rem)]",
  expandedScrollClassName: "max-h-[calc(100dvh-8.25rem)]",
} as const;
/**
 * Sticky offset right under the dark header bar of full-width pages (Header
 * `bar`, `h-16`): the reading progress and the chapters bar of a topic.
 */
export const UNDER_HEADER_BAR = "top-16";
/** Minimum touch target (WCAG 2.5.5). */
export const TOUCH_MIN_PX = 44;

const REM_PX = 16;
const WIDE_RAIL = /^\/(news|region|global-issue)\//;
/** Full-width pages over the map (Topics, encyclopedia entries): the globe shrinks to a corner window. */
const FULL_PAGE = /^\/(topics|entry)(\/|$)/;

export type RailKind = "none" | "normal" | "wide";

/** Path without the language prefix (/cs/…, or the internal /en/… on the server). */
const pagePath = (pathname: string) => splitLocale(withoutDefaultPrefix(pathname)).path;

/** The home map: the only page whose header stays transparent over the globe. */
export const isHome = (pathname: string): boolean => pagePath(pathname) === "/";

/** A full-width page: the globe waits in a small window bottom left. */
export const isFullPage = (pathname: string): boolean => FULL_PAGE.test(pagePath(pathname));

/** Which panel is open on the given path (a full-width page has none). */
export function railKind(pathname: string): RailKind {
  const path = pagePath(pathname);
  if (path === "/" || FULL_PAGE.test(path)) return "none";
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
