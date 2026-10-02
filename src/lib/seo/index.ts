import { DEFAULT_LOCALE, LOCALES, localePath, type Locale } from "@/features/i18n/config";
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";

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

/** Canonical URL and hreflang of a page in its language versions. */
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
      // English if the page has it, otherwise its only/first language.
      "x-default": localePath(
        available.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : (available[0] ?? locale),
        path,
      ),
    },
  };
}

/**
 * Renders JSON-LD. Escapes `<` so the content can't close the <script> –
 * news texts are written by the editors, and even they slip up sometimes.
 */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
