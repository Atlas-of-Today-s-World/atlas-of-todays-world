#!/usr/bin/env node
/**
 * Stahuje a zjednodušuje hranice zemí z Natural Earth do public/data/.
 *
 * Výstupy:
 *   public/data/countries.geo.json      – hranice pro mapu (jen potřebné properties)
 *   public/data/country-labels.geo.json – bodová vrstva popisků (1 bod = 1 země)
 *   src/data/countries.generated.json   – číselník zemí pro server (bez geometrie)
 *
 * Spouštěj po každé aktualizaci Natural Earth: `npm run data:geo`
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// 50m = dobrý kompromis mezi detailem pobřeží a velikostí souboru.
// 110m je 5x menší, ale při zoomu na zemi vypadá hranatě.
const SOURCE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";

/** Na kolik desetinných míst zaokrouhlit souřadnice (3 ≈ 110 m přesnost). */
const PRECISION = 3;

function roundCoords(coords) {
  if (typeof coords[0] === "number") {
    return [
      Number(coords[0].toFixed(PRECISION)),
      Number(coords[1].toFixed(PRECISION)),
    ];
  }
  return coords.map(roundCoords);
}

/** Natural Earth má u sporných území ISO_A3 = "-99"; sáhneme po ADM0_A3. */
function isoOf(p) {
  const iso = p.ISO_A3 && p.ISO_A3 !== "-99" ? p.ISO_A3 : p.ADM0_A3;
  return iso && iso !== "-99" ? iso : null;
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Rozloží MultiPolygon na jednotlivé polygony (vnější prstence). */
function outerRings(geometry) {
  if (geometry.type === "Polygon") return [geometry.coordinates[0]];
  if (geometry.type === "MultiPolygon")
    return geometry.coordinates.map((polygon) => polygon[0]);
  return [];
}

function ringBbox(ring) {
  let minLon = 180;
  let minLat = 90;
  let maxLon = -180;
  let maxLat = -90;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLon, minLat, maxLon, maxLat];
}

/**
 * Výřez pro "zazoomuj na zemi". Bereme jen největší souvislou pevninu, aby
 * Aljaška nerozšířila výřez USA přes celý Pacifik a Chukotka výřez Ruska.
 */
function mainlandBbox(geometry) {
  const rings = outerRings(geometry);
  if (!rings.length) return null;
  let best = null;
  let bestArea = -1;
  for (const ring of rings) {
    const [minLon, minLat, maxLon, maxLat] = ringBbox(ring);
    // Plocha v "stupních", korigovaná o zeměpisnou šířku, ať Grónsko nevyhrává.
    const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
    const area = (maxLon - minLon) * Math.cos(midLat) * (maxLat - minLat);
    if (area > bestArea) {
      bestArea = area;
      best = [minLon, minLat, maxLon, maxLat];
    }
  }
  return best.map((value) => Number(value.toFixed(3)));
}

async function main() {
  process.stdout.write(`Stahuji ${SOURCE}\n`);
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`Natural Earth vrátil ${res.status}`);
  const raw = await res.json();

  const features = [];
  const labels = [];
  const countries = [];

  for (const feature of raw.features) {
    const p = feature.properties ?? {};
    const iso3 = isoOf(p);
    if (!iso3) continue;

    // NAME je běžný krátký název ("Russia"), FORMAL_EN oficiální.
    const name = p.NAME || p.ADMIN || p.NAME_LONG;
    const slug = slugify(name);
    const bbox = mainlandBbox(feature.geometry);
    const labelLon = p.LABEL_X ?? (bbox ? (bbox[0] + bbox[2]) / 2 : null);
    const labelLat = p.LABEL_Y ?? (bbox ? (bbox[1] + bbox[3]) / 2 : null);

    features.push({
      type: "Feature",
      id: iso3,
      properties: { iso3, name, slug },
      geometry: {
        type: feature.geometry.type,
        coordinates: roundCoords(feature.geometry.coordinates),
      },
    });

    if (labelLon !== null && labelLat !== null) {
      labels.push({
        type: "Feature",
        id: iso3,
        properties: { iso3, name, rank: p.LABELRANK ?? 5 },
        geometry: { type: "Point", coordinates: [labelLon, labelLat] },
      });
    }

    countries.push({
      iso3,
      iso2: p.ISO_A2 && p.ISO_A2 !== "-99" ? p.ISO_A2 : null,
      name,
      nameFormal: p.FORMAL_EN || p.NAME_LONG || null,
      slug,
      continent: p.CONTINENT || null,
      unRegion: p.REGION_UN || null,
      unSubregion: p.SUBREGION || null,
      population: typeof p.POP_EST === "number" ? Math.round(p.POP_EST) : null,
      gdpMillionsUsd: typeof p.GDP_MD === "number" ? p.GDP_MD : null,
      labelLon,
      labelLat,
      bbox,
    });
  }

  countries.sort((a, b) => a.name.localeCompare(b.name));

  await mkdir(resolve(ROOT, "public/data"), { recursive: true });
  await mkdir(resolve(ROOT, "src/data"), { recursive: true });

  await writeFile(
    resolve(ROOT, "public/data/countries.geo.json"),
    JSON.stringify({ type: "FeatureCollection", features }),
  );
  await writeFile(
    resolve(ROOT, "public/data/country-labels.geo.json"),
    JSON.stringify({ type: "FeatureCollection", features: labels }),
  );
  await writeFile(
    resolve(ROOT, "src/data/countries.generated.json"),
    `${JSON.stringify(countries, null, 2)}\n`,
  );

  process.stdout.write(
    `Hotovo: ${features.length} zemí, ${labels.length} popisků.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exit(1);
});
