/**
 * Obrysy států pro kvíz na stránce 404.
 *
 * Z hranic, které už má mapa (public/data/countries.geo.json, Natural Earth
 * 1:50m), vyrobí pro 50 dobře rozpoznatelných států zjednodušenou SVG cestu
 * v rámečku 100 × 100. Malé a vzdálené části (zámořská území, drobné
 * ostrovy) vynechá — kvíz má ukázat tvar, který si člověk pamatuje z mapy.
 *
 * Spuštění: node scripts/build-quiz-shapes.mjs → src/features/quiz/shapes.generated.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** 50 států: tvary, které lidé znají, z každého kontinentu. */
const PICK = [
  // Evropa
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
  // Asie
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
  // Afrika
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
  // Amerika
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
  // Oceánie
  "AUS",
  "NZL",
];

const BOX = 100;
const PAD = 4;
/** Část menší než tento podíl největší části se vynechá. */
const MIN_PART_SHARE = 0.01;
/** Část dál než tolik stupňů od největší části se vynechá (zámořská území). */
const MAX_PART_DISTANCE = 30;
/** Douglas–Peucker v jednotkách výsledného rámečku. */
const TOLERANCE = 0.35;

const geo = JSON.parse(readFileSync(resolve(ROOT, "public/data/countries.geo.json"), "utf8"));
const meta = JSON.parse(readFileSync(resolve(ROOT, "src/data/countries.generated.json"), "utf8"));
const metaByIso3 = new Map(meta.map((country) => [country.iso3, country]));

const polygonsOf = (geometry) =>
  geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

/** Plocha prstence ve stupních² (jen pro porovnání velikostí částí). */
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

/** Zjednodušení lomené čáry (Douglas–Peucker), body v rámečku. */
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
 * Uzavřený prstenec má první bod shodný s posledním — Douglas–Peucker by
 * mezi nimi neviděl žádnou úsečku. Rozdělí se proto v nejvzdálenějším bodě.
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
  // Přes 180. poledník (ostrovy u Aljašky, Nový Zéland): záporné délky posunout.
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

  // Ekvidistantní projekce se zkrácením délek podle zeměpisné šířky středu.
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
  if (!feature || !country) throw new Error(`Chybí stát ${iso3}`);
  return { iso3, name: country.name, continent: country.continent, path: shapeOf(feature) };
});

if (new Set(PICK).size !== 50) throw new Error("Kvíz potřebuje přesně 50 různých států.");
const out = resolve(ROOT, "src/features/quiz/shapes.generated.json");
writeFileSync(out, `${JSON.stringify(shapes)}\n`);
const bytes = shapes.reduce((sum, shape) => sum + shape.path.length, 0);
console.log(`Zapsáno ${shapes.length} obrysů, ${Math.round(bytes / 1024)} kB cest → ${out}`);
