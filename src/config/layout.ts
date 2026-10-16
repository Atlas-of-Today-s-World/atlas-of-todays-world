/**
 * Layout dimensions (ARCHITEKTURA 15.1). Single source for JS; the CSS variables
 * in globals.css (`--rail-width`, `--rail-width-wide`, `--touch-min`) must
 * match — layout.test.ts enforces it.
 */

import { splitLocale, withoutDefaultPrefix } from "@/lib/i18n/config";
import { FULL_VIEW_SEGMENT, ROUTE_PREFIX, isAtOrUnder, routes } from "./routes";

/** Right content panel: min(vw, rem). */
export const RAIL = { vw: 38, rem: 27 } as const;
/** Wide panel (region portrait, news item). */
export const RAIL_WIDE = { vw: 52, rem: 46 } as const;

/**
 * Globe window bottom left on full-width pages, in px. Hidden on phones; from
 * Tailwind `sm` up a round button (`compact`); the full window (`desktop`)
 * only from `windowMinPx` (Tailwind `3xl`), where a 72rem column leaves it
 * room beside the text — narrower, the window covered the topic's summary.
 * Content columns keep clear of either (`pl-clear-globe-*` in globals.css).
 */
export const MINI_GLOBE = {
  mobile: { width: 200, height: 132 },
  compact: { width: 64, height: 64 },
  desktop: { width: 280, height: 180 },
  desktopMinPx: 640,
  windowMinPx: 1712,
} as const;

/** Size of the globe window at a viewport width (as the CSS variables set it). */
export function miniGlobeSize(viewportWidth: number): { width: number; height: number } {
  if (viewportWidth >= MINI_GLOBE.windowMinPx) return MINI_GLOBE.desktop;
  return viewportWidth >= MINI_GLOBE.desktopMinPx ? MINI_GLOBE.compact : MINI_GLOBE.mobile;
}

/** From this width up the panel is on the right; below it, a bottom sheet (Tailwind `md`). */
export const DESKTOP_MIN_PX = 768;
/**
 * `sizes` of a photo as wide as a side panel (the bottom sheet on phones), for
 * the browser's pick from its srcset (components/atlas/Photo).
 */
export const PHOTO_SIZES = {
  rail: `(min-width: ${DESKTOP_MIN_PX}px) min(${RAIL.vw}vw, ${RAIL.rem}rem), 100vw`,
  wideRail: `(min-width: ${DESKTOP_MIN_PX}px) min(${RAIL_WIDE.vw}vw, ${RAIL_WIDE.rem}rem), 100vw`,
} as const;
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
 * The "Explore the globe" button (GlobeWake) on phones while the globe waits
 * under an open panel: at the foot of the strip of map, just above the bottom
 * sheet (MOBILE_SHEET.ratio of the window) — the cookie notice takes the top.
 */
export const GLOBE_WAKE_MOBILE = "bottom-[calc(58dvh+1.25rem)]";
/**
 * Sticky offset right under the dark header bar of full-width pages (Header
 * `bar`, `h-16`): the reading progress and the chapters bar of a topic.
 */
export const UNDER_HEADER_BAR = "top-16";
/**
 * A link only keyboard users see: hidden until it takes focus, then a white pill
 * top left above everything ("Skip to content", the home's way to the country list).
 */
export const SKIP_LINK =
  "sr-only z-skip-link rounded-full bg-white px-5 py-3 text-[14px] font-medium text-[var(--color-ink-deep)] focus:not-sr-only focus:fixed focus:top-3 focus:left-3";
/**
 * Globe camera (AtlasGlobe and components/map/globe/): zoom limits, timings and
 * the padding that keeps a focused place clear of the content panel.
 */
export const GLOBE = {
  /** Closest zoom on the full map; the corner window on full-width pages goes below it. */
  minZoom: 0.8,
  maxZoom: 9,
  /** Globe ↔ corner window transition (matches the wrapper's `duration-700`). */
  windowMs: 700,
  /** Flight to the place a page focuses on. */
  flightMs: 1600,
  /** Closest a fit to a country's bounds zooms in (Luxembourg up close, Russia from afar). */
  fitMaxZoom: 6,
  /** Zoom of a flight to a centre that comes without one. */
  fallbackZoom: 3,
  /** Zoom of a country hit in the site search (a flight to its label point). */
  searchCountryZoom: 3.4,
  /** One step of the + / − buttons. */
  zoomStepMs: 300,
  /** Camera padding in px around the focused place. */
  padding: {
    /** On the server, before there is a window to measure. */
    server: 60,
    /** From DESKTOP_MIN_PX up; `railGap` is added to the open panel's width on the right. */
    desktop: { top: 110, bottom: 90, left: 60, railGap: 40 },
    /** Phones: the place sits on the strip above the bottom sheet (MOBILE_SHEET.ratio). */
    mobile: { top: 16, sheetGap: 16, side: 24 },
  },
} as const;
/** Minimum touch target (WCAG 2.5.5). */
export const TOUCH_MIN_PX = 44;

const REM_PX = 16;
/**
 * Pages with the wide panel: a news item and every place preview — a country,
 * a region, a global issue (not the /news index).
 */
const WIDE_RAIL = [
  ROUTE_PREFIX.news,
  ROUTE_PREFIX.country,
  ROUTE_PREFIX.region,
  ROUTE_PREFIX.issue,
];
/** Places with a full-width view at `<place>/full-page` (routes.countryFull…). */
const FULL_VIEW_PREFIXES = [ROUTE_PREFIX.country, ROUTE_PREFIX.region, ROUTE_PREFIX.issue];
const isFullView = (path: string) =>
  path.endsWith(`/${FULL_VIEW_SEGMENT}`) &&
  FULL_VIEW_PREFIXES.some((prefix) => path.startsWith(`${prefix}/`));
const isWideRail = (path: string) => WIDE_RAIL.some((prefix) => path.startsWith(`${prefix}/`));
/**
 * Full-width pages over the map (Topics, topic pages, the Global issues
 * overview) plus every place's `…/full-page` view (isFullView): the globe
 * shrinks to a corner window. A global issue's own address is its rail
 * preview now (2026-10-16), so it left this list. Old /entry/ links redirect
 * (next.config) before they render.
 */
const FULL_PAGES = [routes.topics, routes.globalIssues];
const isFullPagePath = (path: string) =>
  isFullView(path) || FULL_PAGES.some((page) => isAtOrUnder(path, page));

export type RailKind = "none" | "normal" | "wide";

/** Path without the language prefix (/<code>/…, or the internal /en/… on the server). */
export const pagePath = (pathname: string) => splitLocale(withoutDefaultPrefix(pathname)).path;

/** The home map: the only page whose header stays transparent over the globe. */
export const isHome = (pathname: string): boolean => pagePath(pathname) === routes.home;

/** A full-width page: the globe waits in a small window bottom left. */
export const isFullPage = (pathname: string): boolean => isFullPagePath(pagePath(pathname));

/** Which panel is open on the given path (a full-width page has none). */
export function railKind(pathname: string): RailKind {
  const path = pagePath(pathname);
  if (path === routes.home || isFullPagePath(path)) return "none";
  return isWideRail(path) ? "wide" : "normal";
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

/**
 * Left edge of the controls bar over the map (MapControls) from `md` up: clear of
 * the zoom buttons (AtlasGlobe: `left-5`, one 44 px column) plus a gap.
 */
export const MAP_CONTROLS_LEFT = "md:left-20";

/**
 * Widest the map legend may be (ViewSwitcher `MapLegend`): it starts after the
 * attribution (ⓘ) bottom left and must stop before the floating buttons
 * ("Newsletter", "Support the Atlas" — about 10 rem), which sit left of an open panel.
 */
export const LEGEND_MAX_WIDTH: Record<RailKind, string> = {
  none: "md:max-w-[calc(100vw-15rem)]",
  normal: "md:max-w-[calc(100vw-var(--rail-width)-15rem)]",
  wide: "md:max-w-[calc(100vw-var(--rail-width-wide)-15rem)]",
};
