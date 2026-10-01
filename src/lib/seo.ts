import { DEFAULT_LOCALE, LOCALES, localePath, type Locale } from "@/features/i18n/config";
import type { Metadata } from "next";
import { SITE_URL } from "./site";

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

/**
 * Geo meta tags. An older standard (geo.position / ICBM / geo.region) read by
 * local search engines and aggregators; modern bots use the JSON-LD below,
 * but this costs nothing and broadens reach.
 */
export function geoMeta(input: {
  lat: number | null;
  lon: number | null;
  placename: string;
  /** ISO 3166-1 alpha-2, optionally alpha-2 with a region. */
  regionCode?: string | null;
}): Record<string, string> {
  const out: Record<string, string> = { "geo.placename": input.placename };
  if (input.regionCode) out["geo.region"] = input.regionCode;
  if (input.lat !== null && input.lon !== null) {
    const position = `${input.lat.toFixed(4)};${input.lon.toFixed(4)}`;
    out["geo.position"] = position;
    out.ICBM = `${input.lat.toFixed(4)}, ${input.lon.toFixed(4)}`;
    out["place:location:latitude"] = input.lat.toFixed(4);
    out["place:location:longitude"] = input.lon.toFixed(4);
  }
  return out;
}

/** Language variants. English only for now, but hreflang is ready. */
export function alternates(
  path: string,
  locale: Locale = DEFAULT_LOCALE,
  /**
   * Languages the page actually exists in (news items and entries only where
   * a translation is published, G5.3). Without it, all site languages.
   */
  available: readonly Locale[] = LOCALES,
): Metadata["alternates"] {
  return {
    canonical: localePath(locale, path),
    languages: {
      ...Object.fromEntries(available.map((item) => [item, localePath(item, path)])),
      "x-default": path,
    },
  };
}

export interface Crumb {
  name: string;
  path: string;
}

/** Breadcrumbs for bots – Google builds the result path from them. */
export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/** Coordinates in the shape schema.org understands. */
export function geoCoordinates(lat: number | null, lon: number | null) {
  if (lat === null || lon === null) return undefined;
  return {
    "@type": "GeoCoordinates" as const,
    latitude: Number(lat.toFixed(4)),
    longitude: Number(lon.toFixed(4)),
  };
}

/**
 * Renders JSON-LD. Escapes `<` so the content can't close the <script> –
 * news texts are written by the editors, and even they slip up sometimes.
 */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
