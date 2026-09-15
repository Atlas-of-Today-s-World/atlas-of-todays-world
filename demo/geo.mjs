#!/usr/bin/env node
/**
 * Postaví `demo/atlas-geo.js` – geometrii pro sdílenou ukázku.
 *
 * Ukázka kreslí globus na canvas přes d3-geo, a to je na rozdíl od MapLibre
 * citlivé na směr obtáčení prstence: prstenec obtočený opačně znamená na kouli
 * "všechno kromě" a jediný takový ostrov přebarví celou planetu. Zjednodušení
 * proto vždycky srovná směr podle původního prstence a zahodí ty, které se
 * zaokrouhlením smrskly na nulovou plochu.
 *
 * Dvě úrovně:
 *   ATLAS_GEO      – plná geometrie (co má i aplikace)
 *   ATLAS_GEO_LITE – hrubší, kreslí se během otáčení
 *
 * Použití: npm run demo:geo
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(HERE, "..", "public/data/countries.geo.json");
const TARGET = resolve(HERE, "atlas-geo.js");

/** Hrubší úroveň pro otáčení. */
const LITE_TOLERANCE = 0.16;
const LITE_MIN_AREA = 0.12;
const LITE_DIGITS = 2;

function sqSegmentDistance(p, a, b) {
  let x = a[0];
  let y = a[1];
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = b[0]; y = b[1]; }
    else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

function simplifyRing(points, tolerance) {
  if (points.length <= 5) return points;
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
      if (sq > maxSq) { maxSq = sq; index = i; }
    }
    if (maxSq > sqTolerance && index > 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  const out = [];
  for (let i = 0; i < points.length; i += 1) if (keep[i]) out.push(points[i]);
  return out.length < 5 ? points : out;
}

/** Shoelace se znaménkem: kladné = proti směru hodinových ručiček. */
function signedArea(ring) {
  let sum = 0;
  for (let i = 0, n = ring.length - 1; i < n; i += 1) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return sum / 2;
}

/**
 * Zjednodušený prstenec: zaokrouhlí, uzavře, srovná směr podle předlohy.
 * Vrátí null, když z něj nic nezbylo.
 */
function tidyRing(source, tolerance, digits) {
  const round = (v) => Number(v.toFixed(digits));
  const simplified = simplifyRing(source, tolerance).map((p) => [round(p[0]), round(p[1])]);

  // Vyhodit body, které po zaokrouhlení splynuly se sousedem.
  const compact = simplified.filter(
    (p, i) => i === 0 || p[0] !== simplified[i - 1][0] || p[1] !== simplified[i - 1][1],
  );
  if (compact.length < 4) return null;

  const first = compact[0];
  const last = compact[compact.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) compact.push([first[0], first[1]]);
  if (compact.length < 4) return null;

  const area = signedArea(compact);
  if (Math.abs(area) < 1e-7) return null;
  // Tohle je ta pojistka: opačně obtočený prstenec obarví na kouli celý svět.
  if (Math.sign(area) !== Math.sign(signedArea(source))) compact.reverse();
  return compact;
}

function liteGeometry(geometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const kept = [];

  for (const polygon of polygons) {
    const outer = tidyRing(polygon[0], LITE_TOLERANCE, LITE_DIGITS);
    if (!outer || Math.abs(signedArea(outer)) < LITE_MIN_AREA) continue;
    const rings = [outer];
    for (let i = 1; i < polygon.length; i += 1) {
      const hole = tidyRing(polygon[i], LITE_TOLERANCE, LITE_DIGITS);
      if (hole && Math.abs(signedArea(hole)) >= LITE_MIN_AREA * 4) rings.push(hole);
    }
    kept.push(rings);
  }

  if (!kept.length) {
    // Země nesmí z hrubé úrovně zmizet – necháme jí největší ostrov jemněji.
    const biggest = polygons
      .map((p) => ({ p, area: Math.abs(signedArea(p[0])) }))
      .sort((a, b) => b.area - a.area)[0];
    const ring = tidyRing(biggest.p[0], LITE_TOLERANCE / 4, LITE_DIGITS);
    if (!ring) return null;
    kept.push([ring]);
  }

  return kept.length === 1
    ? { type: "Polygon", coordinates: kept[0] }
    : { type: "MultiPolygon", coordinates: kept };
}

/** Kontrola: žádný prstenec nesmí být obtočený jinak než jeho předloha. */
function ringsOf(geometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flat();
}

function countPoints(geometry) {
  return ringsOf(geometry).reduce((sum, ring) => sum + ring.length, 0);
}

const full = JSON.parse(await readFile(SOURCE, "utf8"));

const liteFeatures = [];
for (const feature of full.features) {
  const geometry = liteGeometry(feature.geometry);
  if (!geometry) continue;
  liteFeatures.push({
    type: "Feature",
    id: feature.id,
    properties: feature.properties,
    geometry,
  });
}
const lite = { type: "FeatureCollection", features: liteFeatures };

// Obě úrovně musí mít všechny prstence obtočené stejným směrem jako předloha.
let suspicious = 0;
for (const collection of [full, lite]) {
  for (const feature of collection.features) {
    for (const ring of ringsOf(feature.geometry)) {
      const area = signedArea(ring);
      if (!Number.isFinite(area) || Math.abs(area) < 1e-9) suspicious += 1;
    }
  }
}
if (suspicious) throw new Error(`${suspicious} prstenců s nulovou plochou – geometrie by se rozpadla`);

await writeFile(
  TARGET,
  `window.ATLAS_GEO=${JSON.stringify(full)};\nwindow.ATLAS_GEO_LITE=${JSON.stringify(lite)};\n`,
  "utf8",
);

const points = (c) => c.features.reduce((sum, f) => sum + countPoints(f.geometry), 0);
process.stdout.write(
  `demo/atlas-geo.js · plná ${full.features.length} zemí / ${points(full).toLocaleString("cs")} bodů` +
    ` · hrubá ${lite.features.length} / ${points(lite).toLocaleString("cs")} bodů\n`,
);
