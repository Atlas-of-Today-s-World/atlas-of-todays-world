/**
 * Where to open the globe when the user arrives on the home page.
 *
 * We don't use browser geolocation – it pops up a permission prompt, which is
 * needlessly invasive for "open it near me". Instead, in this order:
 *   1. the country of the visitor's IP address (Vercel's edge header, read by
 *      /api/geo — only the country code, nothing stored),
 *   2. time zone (Europe/Prague → Czechia),
 *   3. language (cs-CZ, or `cs` expanded to CZ via Intl.Locale),
 *   4. if nothing matches, the center of Europe.
 */

import { MINI_GLOBE } from "@/config/layout";

/** Center of Europe – the default view when the location can't be determined. */
export const EUROPE_CENTER: [number, number] = [14, 49.5];

/**
 * Zoom at which the globe fills the window. MapLibre's world circumference is
 * 512·2^zoom pixels, so the globe's diameter is (512·2^zoom)/π – from that we
 * derive the zoom for the desired diameter in pixels.
 *
 * A small window yields a lower zoom; that's why country labels have a low
 * minzoom, so they are visible there too.
 */
export function globeFillZoom(fill = GLOBE_FILL): number {
  if (typeof window === "undefined") return 2.6;
  const diameter = Math.min(window.innerWidth, window.innerHeight) * fill;
  return Math.max(FILL_ZOOM.min, Math.min(FILL_ZOOM.max, zoomForDiameter(diameter)));
}

/**
 * Share of the shorter window side the home globe spans: a little over the
 * window (1.25, i.e. 20 % closer than the whole sphere at 1.04), so the land
 * fills the screen and the rim slips just past the edges.
 */
const GLOBE_FILL = 1.25;
/** Bounds of the home zoom (scaled with the fill): legible names, a sphere still recognisable. */
const FILL_ZOOM = { min: 1.96, max: 3.66 } as const;

const zoomForDiameter = (diameterPx: number) => Math.log2((diameterPx * Math.PI) / 512);
const diameterAt = (zoom: number) => Math.round((512 * 2 ** zoom) / Math.PI);

/**
 * The same size as CSS, for the placeholder sphere shown until the map has
 * loaded (it renders on the server, before any script runs).
 */
export const GLOBE_FILL_SIZE_CSS = `clamp(${diameterAt(FILL_ZOOM.min)}px, min(${GLOBE_FILL * 100}vw, ${GLOBE_FILL * 100}dvh), ${diameterAt(FILL_ZOOM.max)}px)`;

/**
 * Zoom at which the whole globe fits the small window on full-width pages
 * (with a thin margin). Below MapLibre's usual minimum, so the map's minZoom
 * is lowered while the window is shown.
 */
export function miniGlobeZoom(viewportWidth: number): number {
  const size = viewportWidth >= MINI_GLOBE.desktopMinPx ? MINI_GLOBE.desktop : MINI_GLOBE.mobile;
  return zoomForDiameter(Math.min(size.width, size.height) * 0.9);
}

/** How long the home page waits for the IP country before using the time zone. */
const IP_COUNTRY_TIMEOUT_MS = 1200;

/**
 * Country of the visitor's IP address (ISO 3166-1 alpha-2) from /api/geo, or
 * null when unknown, slow or failed — the caller then falls back to the time zone.
 */
export async function fetchIpCountry(): Promise<string | null> {
  try {
    const response = await fetch("/api/geo", {
      cache: "no-store",
      signal: AbortSignal.timeout(IP_COUNTRY_TIMEOUT_MS),
    });
    const data = (await response.json()) as { country?: unknown };
    return typeof data.country === "string" && /^[A-Z]{2}$/.test(data.country)
      ? data.country
      : null;
  } catch {
    return null;
  }
}
