#!/usr/bin/env node
/**
 * Shrinks country borders for the map. Runs on what `npm run data:geo` downloaded.
 *
 * Three steps, each measurable:
 *   1. Douglas–Peucker simplification of every ring.
 *   2. Dropping tiny islands that are below a pixel on the globe anyway.
 *   3. Rounding coordinates (default 2 decimal places ≈ 1 km).
 *
 * Quality drops only where it cannot be seen from space; the shape of
 * landmasses and the borders between neighbours stay.
 *
 * Usage: npm run data:optimise -- [tolerance] [minArea] [decimalPlaces]
 */
import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(ROOT, "public/data/countries.geo.json");

const [, , tolArg, areaArg, digitsArg] = process.argv;
/** Simplification tolerance in degrees. 0.04° ≈ 4 km. */
const TOLERANCE = Number(tolArg ?? 0.04);
/** Smallest island area in square degrees that is still drawn. */
const MIN_AREA = Number(areaArg ?? 0.02);
const DIGITS = Number(digitsArg ?? 2);

/** Perpendicular distance of a point from a segment – the core of Douglas–Peucker. */
function sqSegmentDistance(p, a, b) {
  let x = a[0];
  let y = a[1];
  let dx = b[0] - x;
  let dy = b[1] - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

function simplifyRing(points, tolerance) {
  if (points.length <= 4) return points;
  const sqTolerance = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxSq = 0;
    let index = -1;
    for (let i = first + 1; i < last; i += 1) {
      const sq = sqSegmentDistance(points[i], points[first], points[last]);
      if (sq > maxSq) {
        maxSq = sq;
        index = i;
      }
    }
    if (maxSq > sqTolerance && index > 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  const out = [];
  for (let i = 0; i < points.length; i += 1) if (keep[i]) out.push(points[i]);
  // The polygon must stay closed and be at least a triangle.
  if (out.length < 4) return points;
  return out;
}

/**
 * Signed shoelace: positive = ring wound counter-clockwise. Simplification
 * and rounding can flip the winding of a tiny island, and on a sphere such a
 * ring then means "everything except" – one such island repaints the whole
 * planet. So after processing we always align the winding with the source.
 */
function signedArea(ring) {
  let sum = 0;
  for (let i = 0, n = ring.length - 1; i < n; i += 1) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return sum / 2;
}

/** Ring after simplification: closed, no merged points, correct winding. */
function tidyRing(source, tolerance) {
  const simplified = simplifyRing(source, tolerance).map((point) => [
    round(point[0]),
    round(point[1]),
  ]);
  const compact = simplified.filter(
    (point, i) => i === 0 || point[0] !== simplified[i - 1][0] || point[1] !== simplified[i - 1][1],
  );
  if (compact.length < 4) return null;

  const first = compact[0];
  const last = compact[compact.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) compact.push([first[0], first[1]]);
  if (compact.length < 4 || Math.abs(signedArea(compact)) < 1e-7) return null;
  if (Math.sign(signedArea(compact)) !== Math.sign(signedArea(source))) compact.reverse();
  return compact;
}

/** Ring area in square degrees (shoelace), corrected for latitude. */
function ringArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  const midLat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return Math.abs(sum / 2) * Math.cos((midLat * Math.PI) / 180);
}

const round = (value) => Number(value.toFixed(DIGITS));

function processPolygon(polygon) {
  const outer = tidyRing(polygon[0], TOLERANCE);
  if (!outer || ringArea(outer) < MIN_AREA) return null;

  const rings = [outer];
  // Keep only holes (lakes, enclaves) that still matter after simplification.
  for (let i = 1; i < polygon.length; i += 1) {
    const hole = tidyRing(polygon[i], TOLERANCE);
    if (hole && ringArea(hole) >= MIN_AREA * 4) rings.push(hole);
  }
  return rings;
}

function countPoints(coords) {
  return typeof coords[0] === "number" ? 1 : coords.reduce((sum, c) => sum + countPoints(c), 0);
}

async function main() {
  const geo = JSON.parse(await readFile(SOURCE, "utf8"));
  const before = { bytes: (await stat(SOURCE)).size, points: 0, features: geo.features.length };

  const features = [];
  let dropped = 0;

  for (const feature of geo.features) {
    before.points += countPoints(feature.geometry.coordinates);
    const polygons =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;

    const kept = polygons.map(processPolygon).filter(Boolean);
    if (!kept.length) {
      // Never drop a whole country – keep its largest island instead.
      const biggest = polygons
        .map((p) => ({ p, area: ringArea(p[0]) }))
        .sort((a, b) => b.area - a.area)[0];
      const ring = tidyRing(biggest.p[0], TOLERANCE / 3);
      if (ring) kept.push([ring]);
      dropped += polygons.length - 1;
    } else {
      dropped += polygons.length - kept.length;
    }

    features.push({
      type: "Feature",
      id: feature.id,
      properties: feature.properties,
      geometry:
        kept.length === 1
          ? { type: "Polygon", coordinates: kept[0] }
          : { type: "MultiPolygon", coordinates: kept },
    });
  }

  const out = { type: "FeatureCollection", features };
  await writeFile(SOURCE, JSON.stringify(out));

  const after = { bytes: (await stat(SOURCE)).size, points: 0 };
  for (const f of features) after.points += countPoints(f.geometry.coordinates);

  const pct = (a, b) => `${Math.round((1 - a / b) * 100)} %`;
  process.stdout.write(
    [
      `tolerance ${TOLERANCE}°, min. area ${MIN_AREA}, ${DIGITS} decimal places`,
      `points:   ${before.points.toLocaleString("cs")} -> ${after.points.toLocaleString("cs")}  (-${pct(after.points, before.points)})`,
      `size:     ${(before.bytes / 1024 / 1024).toFixed(2)} MB -> ${(after.bytes / 1024 / 1024).toFixed(2)} MB  (-${pct(after.bytes, before.bytes)})`,
      `tiny islands dropped: ${dropped}`,
      "",
    ].join("\n"),
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exit(1);
});
