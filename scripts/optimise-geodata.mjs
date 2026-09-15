#!/usr/bin/env node
/**
 * Zmenší hranice zemí pro mapu. Běží nad tím, co stáhl `npm run data:geo`.
 *
 * Tři úpravy, každá měřitelná:
 *   1. Douglas–Peucker zjednodušení každého prstence.
 *   2. Zahození drobných ostrovů, které jsou na globusu stejně pod pixel.
 *   3. Zaokrouhlení souřadnic (výchozí 2 desetinná místa ≈ 1 km).
 *
 * Kvalita klesne jen tam, kde to při pohledu z vesmíru není vidět; tvar
 * pevnin a hranice mezi sousedy zůstávají.
 *
 * Použití: npm run data:optimise -- [tolerance] [minPlocha] [desetinnáMísta]
 */
import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(ROOT, "public/data/countries.geo.json");

const [, , tolArg, areaArg, digitsArg] = process.argv;
/** Tolerance zjednodušení ve stupních. 0.04° ≈ 4 km. */
const TOLERANCE = Number(tolArg ?? 0.04);
/** Nejmenší plocha ostrova ve čtverečních stupních, kterou ještě kreslíme. */
const MIN_AREA = Number(areaArg ?? 0.02);
const DIGITS = Number(digitsArg ?? 2);

/** Kolmá vzdálenost bodu od úsečky – jádro Douglas–Peuckera. */
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
  // Polygon musí zůstat uzavřený a mít aspoň trojúhelník.
  if (out.length < 4) return points;
  return out;
}

/** Plocha prstence ve čtverečních stupních (shoelace), korigovaná o šířku. */
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
  const outer = simplifyRing(polygon[0], TOLERANCE);
  if (ringArea(outer) < MIN_AREA) return null;

  const rings = [outer];
  // Díry (jezera, enklávy) necháváme jen ty, co po zjednodušení něco znamenají.
  for (let i = 1; i < polygon.length; i += 1) {
    const hole = simplifyRing(polygon[i], TOLERANCE);
    if (ringArea(hole) >= MIN_AREA * 4) rings.push(hole);
  }
  return rings.map((ring) => ring.map((p) => [round(p[0]), round(p[1])]));
}

function countPoints(coords) {
  return typeof coords[0] === "number"
    ? 1
    : coords.reduce((sum, c) => sum + countPoints(c), 0);
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
      // Nikdy nezahodíme celou zemi – radši u ní necháme největší ostrov.
      const biggest = polygons
        .map((p) => ({ p, area: ringArea(p[0]) }))
        .sort((a, b) => b.area - a.area)[0];
      kept.push([
        simplifyRing(biggest.p[0], TOLERANCE / 3).map((c) => [round(c[0]), round(c[1])]),
      ]);
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
      `tolerance ${TOLERANCE}°, min. plocha ${MIN_AREA}, ${DIGITS} desetinná místa`,
      `body:     ${before.points.toLocaleString("cs")} -> ${after.points.toLocaleString("cs")}  (-${pct(after.points, before.points)})`,
      `velikost: ${(before.bytes / 1024 / 1024).toFixed(2)} MB -> ${(after.bytes / 1024 / 1024).toFixed(2)} MB  (-${pct(after.bytes, before.bytes)})`,
      `zahozeno drobných ostrovů: ${dropped}`,
      "",
    ].join("\n"),
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exit(1);
});
