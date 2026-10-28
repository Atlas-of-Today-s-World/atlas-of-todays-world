import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { geoArea, geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { THEME_COLORS } from "@/config/palette";

/** What the globe of a preview image shows. */
export interface OgGlobe {
  /** [lon, lat] turned to the middle of the globe. */
  center: [number, number];
  /** ISO3 -> fill of the coloured countries; every other country is muted. */
  fills: Record<string, string>;
  /** The subject's countries, outlined in white. */
  outline?: string[];
  /** Ring the (first) outlined country — a small country is hard to find otherwise. */
  pin?: boolean;
}

type Country = Feature<Polygon | MultiPolygon, { iso3: string }>;

/** Countries outside the subject: a shade above the sea. */
const MUTED = "#2b3654";

let borders: Promise<Country[]> | undefined;

/**
 * The map's own borders (public/data/countries.geo.json). d3 reads a ring's
 * winding as which side is inside: GeoJSON's counter-clockwise outer rings would
 * fill the rest of the sphere, so any polygon covering more than half is turned.
 */
function loadBorders() {
  borders ??= readFile(join(process.cwd(), "public/data/countries.geo.json"), "utf8").then(
    (text) => {
      const { features } = JSON.parse(text) as FeatureCollection<
        Polygon | MultiPolygon,
        { iso3: string }
      >;
      for (const { geometry } of features) {
        const polygons =
          geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
        for (const rings of polygons) {
          if (geoArea({ type: "Polygon", coordinates: rings }) > 2 * Math.PI) {
            for (const ring of rings) ring.reverse();
          }
        }
      }
      return features;
    },
  );
  return borders;
}

/** The globe as an SVG document `size` px square, lit from the top left. */
export async function globeSvg({ center, fills, outline = [], pin }: OgGlobe, size: number) {
  const countries = await loadBorders();
  const radius = size / 2 - 4;
  const mid = size / 2;
  const path = geoPath(
    geoOrthographic()
      .scale(radius)
      .translate([mid, mid])
      .rotate([-center[0], -center[1]])
      .clipAngle(90),
  ).digits(1);

  const subject = new Set(outline);
  const land = countries
    .map((country) => {
      const d = path(country);
      return d
        ? `<path d="${d}" fill="${fills[country.properties.iso3] ?? MUTED}" stroke="${THEME_COLORS.space}" stroke-width="0.7" stroke-linejoin="round"/>`
        : "";
    })
    .join("");
  const subjectCountries = countries.filter((country) => subject.has(country.properties.iso3));
  const outlines = subjectCountries
    .map((country) => path(country))
    .filter(Boolean)
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="0.85" stroke-width="1.6" stroke-linejoin="round"/>`,
    )
    .join("");

  let ring = "";
  if (pin && subjectCountries[0]) {
    const [x, y] = path.centroid(subjectCountries[0]);
    const r = Math.max(26, size * 0.034);
    ring =
      `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#fff" stroke-width="2.5"/>` +
      `<circle cx="${x}" cy="${y}" r="${r * 1.7}" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="1.5"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs>
<radialGradient id="sea" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#1c2a52"/><stop offset="1" stop-color="#101a33"/></radialGradient>
<radialGradient id="shade" cx="35%" cy="30%" r="80%"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient>
</defs>
<circle cx="${mid}" cy="${mid}" r="${radius}" fill="none" stroke="${THEME_COLORS.accentBright}" stroke-opacity="0.35" stroke-width="2"/>
<circle cx="${mid}" cy="${mid}" r="${radius}" fill="url(#sea)"/>
<path d="${path(geoGraticule10())}" fill="none" stroke="#fff" stroke-opacity="0.06"/>
${land}${outlines}
<circle cx="${mid}" cy="${mid}" r="${radius}" fill="url(#shade)"/>${ring}
</svg>`;
}
