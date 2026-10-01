/**
 * Country outlines for the quiz on the 404 page.
 *
 * From the borders the map already has (public/data/countries.geo.json, Natural
 * Earth 1:50m), builds a simplified SVG path in a 100 × 100 box for 50 easily
 * recognisable countries. Small and distant parts (overseas territories, tiny
 * islands) are dropped — the quiz should show the shape people remember from a map.
 *
 * Run: node scripts/build-quiz-shapes.mjs → src/features/quiz/shapes.generated.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** 50 countries: shapes people know, from every continent. */
const PICK = [
  // Europe
  "ITA",
  "GBR",
  "FRA",
  "ESP",
  "PRT",
  "NOR",
  "SWE",
  "FIN",
  "ISL",
  "IRL",
  "GRC",
  "POL",
  "DEU",
  "UKR",
  "HRV",
  // Asia
  "JPN",
  "CHN",
  "IND",
  "VNM",
  "THA",
  "IDN",
  "PHL",
  "MNG",
  "KAZ",
  "IRN",
  "TUR",
  "SAU",
  "LKA",
  // Africa
  "EGY",
  "ZAF",
  "MDG",
  "NGA",
  "ETH",
  "SOM",
  "MAR",
  "KEN",
  "COD",
  "NAM",
  // Americas
  "USA",
  "CAN",
  "MEX",
  "BRA",
  "ARG",
  "CHL",
  "PER",
  "COL",
  "CUB",
  "BOL",
  // Oceania
  "AUS",
  "NZL",
];

const BOX = 100;
const PAD = 4;
/** Parts smaller than this share of the largest part are dropped. */
const MIN_PART_SHARE = 0.01;
/** Parts farther than this many degrees from the largest part are dropped (overseas territories). */
const MAX_PART_DISTANCE = 30;
/** Douglas–Peucker tolerance in units of the output box. */
const TOLERANCE = 0.35;

const geo = JSON.parse(readFileSync(resolve(ROOT, "public/data/countries.geo.json"), "utf8"));
const meta = JSON.parse(readFileSync(resolve(ROOT, "src/data/countries.generated.json"), "utf8"));
const metaByIso3 = new Map(meta.map((country) => [country.iso3, country]));

const polygonsOf = (geometry) =>
  geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

/** Ring area in degrees² (only for comparing part sizes). */
function ringArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(sum / 2);
}

function centroid(ring) {
  const n = ring.length;
  return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
}

/** Polyline simplification (Douglas–Peucker), points in the box. */
function simplify(points, tolerance) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    const [ax, ay] = points[start];
    const [bx, by] = points[end];
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy) || 1;
    let worst = -1;
    let worstDistance = 0;
    for (let i = start + 1; i < end; i++) {
      const distance = Math.abs(dy * points[i][0] - dx * points[i][1] + bx * ay - by * ax) / length;
      if (distance > worstDistance) {
        worstDistance = distance;
        worst = i;
      }
    }
    if (worstDistance > tolerance) {
      keep[worst] = 1;
      stack.push([start, worst], [worst, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/**
 * A closed ring has its first point equal to the last — Douglas–Peucker would
 * see no segment between them. So it is split at the farthest point.
 */
function simplifyRing(ring, tolerance) {
  const open = ring.slice(0, -1);
  let far = 0;
  let farDistance = 0;
  open.forEach(([x, y], i) => {
    const distance = Math.hypot(x - open[0][0], y - open[0][1]);
    if (distance > farDistance) {
      farDistance = distance;
      far = i;
    }
  });
  return [
    ...simplify(open.slice(0, far + 1), tolerance),
    ...simplify([...open.slice(far), open[0]], tolerance).slice(1),
  ];
}

function shapeOf(feature) {
  let polygons = polygonsOf(feature.geometry);
  // Across the 180th meridian (islands off Alaska, New Zealand): shift negative longitudes.
  const lons = polygons.flat(2).map(([lon]) => lon);
  if (Math.max(...lons) - Math.min(...lons) > 180) {
    polygons = polygons.map((polygon) =>
      polygon.map((ring) => ring.map(([lon, lat]) => [lon < 0 ? lon + 360 : lon, lat])),
    );
  }

  const largest = polygons.reduce((best, polygon) =>
    ringArea(polygon[0]) > ringArea(best[0]) ? polygon : best,
  );
  const [cx, cy] = centroid(largest[0]);
  const largestArea = ringArea(largest[0]);
  const kept = polygons.filter((polygon) => {
    const [px, py] = centroid(polygon[0]);
    return (
      ringArea(polygon[0]) >= largestArea * MIN_PART_SHARE &&
      Math.hypot(px - cx, py - cy) <= MAX_PART_DISTANCE
    );
  });

  // Equirectangular projection, longitudes shortened by the latitude of the centre.
  const scaleX = Math.cos((cy * Math.PI) / 180);
  const rings = kept.flat().map((ring) => ring.map(([lon, lat]) => [lon * scaleX, -lat]));
  const xs = rings.flat().map((p) => p[0]);
  const ys = rings.flat().map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const scale = (BOX - 2 * PAD) / Math.max(maxX - minX, maxY - minY);
  const offsetX = (BOX - (maxX - minX) * scale) / 2;
  const offsetY = (BOX - (maxY - minY) * scale) / 2;

  const round = (value) => Math.round(value * 10) / 10;
  return rings
    .map((ring) =>
      simplifyRing(
        ring.map(([x, y]) => [(x - minX) * scale + offsetX, (y - minY) * scale + offsetY]),
        TOLERANCE,
      ),
    )
    .filter((ring) => ring.length >= 4)
    .map((ring) => `M${ring.map(([x, y]) => `${round(x)} ${round(y)}`).join("L")}Z`)
    .join("");
}

const shapes = PICK.map((iso3) => {
  const feature = geo.features.find((item) => item.properties.iso3 === iso3);
  const country = metaByIso3.get(iso3);
  if (!feature || !country) throw new Error(`Missing country ${iso3}`);
  return { iso3, name: country.name, continent: country.continent, path: shapeOf(feature) };
});

if (new Set(PICK).size !== 50) throw new Error("The quiz needs exactly 50 distinct countries.");
const out = resolve(ROOT, "src/features/quiz/shapes.generated.json");
writeFileSync(out, `${JSON.stringify(shapes)}\n`);
const bytes = shapes.reduce((sum, shape) => sum + shape.path.length, 0);
console.log(`Wrote ${shapes.length} outlines, ${Math.round(bytes / 1024)} kB of paths → ${out}`);
