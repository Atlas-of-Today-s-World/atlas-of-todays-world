import type { Metadata } from "next";
import { SITE_URL } from "./site";

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

/**
 * Geo meta tagy. Starší standard (geo.position / ICBM / geo.region), který
 * čtou lokální vyhledávače a agregátory; moderní roboti berou JSON-LD níž,
 * ale tohle nic nestojí a rozšiřuje záběr.
 */
export function geoMeta(input: {
  lat: number | null;
  lon: number | null;
  placename: string;
  /** ISO 3166-1 alpha-2, případně alpha-2 s regionem. */
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

/** Jazykové varianty. Zatím jen angličtina, ale hreflang je připravený. */
export function alternates(path: string): Metadata["alternates"] {
  return {
    canonical: path,
    languages: { en: path, "x-default": path },
  };
}

export interface Crumb {
  name: string;
  path: string;
}

/** Drobečková navigace pro roboty – Google z ní staví cestu ve výsledcích. */
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

/** Souřadnice ve tvaru, kterému rozumí schema.org. */
export function geoCoordinates(lat: number | null, lon: number | null) {
  if (lat === null || lon === null) return undefined;
  return {
    "@type": "GeoCoordinates" as const,
    latitude: Number(lat.toFixed(4)),
    longitude: Number(lon.toFixed(4)),
  };
}

/** Obdélníkový výřez země – roboti z něj poznají rozsah území. */
export function geoShape(bbox: [number, number, number, number] | null) {
  if (!bbox) return undefined;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return {
    "@type": "GeoShape" as const,
    box: `${minLat} ${minLon} ${maxLat} ${maxLon}`,
  };
}

/**
 * Vykreslí JSON-LD. Escapuje `<`, aby obsah nemohl uzavřít <script> –
 * texty hesel píše redakce, ale i ta se občas splete.
 */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
