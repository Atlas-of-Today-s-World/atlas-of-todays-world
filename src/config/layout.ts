/**
 * Rozměry layoutu (ARCHITEKTURA 15.1). Jediný zdroj pro JS; CSS proměnné
 * v globals.css (`--rail-width`, `--rail-width-wide`, `--touch-min`) musí
 * odpovídat — hlídá to layout.test.ts.
 */

/** Pravý panel s obsahem: min(vw, rem). */
export const RAIL = { vw: 38, rem: 27 } as const;
/** Široký panel (portrét regionu, global issue, novinka). */
export const RAIL_WIDE = { vw: 52, rem: 46 } as const;

/** Od této šířky je panel vpravo; pod ní je spodní sheet (Tailwind `md`). */
export const DESKTOP_MIN_PX = 768;
/** Minimální dotykový cíl (WCAG 2.5.5). */
export const TOUCH_MIN_PX = 44;

const REM_PX = 16;
const WIDE_RAIL = /^\/(news|region|global-issue)\//;

export type RailKind = "none" | "normal" | "wide";

/** Jaký panel je na dané cestě otevřený. */
export function railKind(pathname: string): RailKind {
  if (pathname === "/") return "none";
  return WIDE_RAIL.test(pathname) ? "wide" : "normal";
}

/** Šířka panelu v px pro dané okno (0 na mobilu nebo bez panelu). */
export function railWidthPx(kind: RailKind, viewportWidth: number): number {
  if (kind === "none" || viewportWidth < DESKTOP_MIN_PX) return 0;
  const size = kind === "wide" ? RAIL_WIDE : RAIL;
  return Math.min((viewportWidth * size.vw) / 100, size.rem * REM_PX);
}

/**
 * Odsazení prvků nad mapou od pravého panelu (Header, MapControls).
 * Třídy jsou vypsané celé, aby je Tailwind našel.
 */
export const RAIL_OFFSET: Record<RailKind, string> = {
  none: "md:right-7",
  normal: "md:right-[calc(var(--rail-width)+1.25rem)]",
  wide: "md:right-[calc(var(--rail-width-wide)+1.25rem)]",
};
