import type { RequestTransformFunction } from "maplibre-gl";
import glyphs from "@/data/glyphs.json";

/**
 * Map label glyphs (SDF font ranges), served with the site from
 * public/data/glyphs/ (scripts/fetch-glyphs.mjs) for the ranges labels use;
 * a label needing any other range gets that one from fonts.openmaptiles.org,
 * where these were downloaded from (MapLibre asks per 256 code points).
 */
export const glyphsUrl = () =>
  `${typeof window === "undefined" ? "" : window.location.origin}/data/glyphs/{fontstack}/{range}.pbf`;
const FALLBACK = "https://fonts.openmaptiles.org";
const HOSTED = new Set(glyphs.ranges);
const RANGE = /\/data\/glyphs\/([^/]+)\/(\d+-\d+)\.pbf$/;

/** The glyph range's address: ours when we host it, otherwise the fallback's. */
export function glyphRequestUrl(url: string): string {
  const match = RANGE.exec(url);
  if (!match || HOSTED.has(match[2] ?? "")) return url;
  return `${FALLBACK}/${match[1]}/${match[2]}.pbf`;
}

/** MapLibre `transformRequest`: glyph ranges we don't host go to the fallback. */
export const transformGlyphRequest: RequestTransformFunction = (url, resourceType) =>
  resourceType === "Glyphs" ? { url: glyphRequestUrl(url) } : undefined;
