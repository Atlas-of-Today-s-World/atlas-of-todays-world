#!/usr/bin/env node
/**
 * Downloads and simplifies country borders from Natural Earth into public/data/.
 *
 * Outputs:
 *   public/data/countries.geo.json      – borders for the map (only needed properties)
 *   public/data/country-labels.geo.json – point layer of labels (1 point = 1 country)
 *   src/data/countries.generated.json   – country registry for the server (no geometry)
 *
 * Natural Earth draws borders "de facto": Crimea under Russia, the Golan under
 * Israel, Northern Cyprus and Somaliland as separate units. The atlas follows UN
 * practice, so the rules from `src/data/territories.json` are applied to the
 * downloaded data – territories are transferred, merged or just flagged. The
 * editorial decision lives there; this is only its execution.
 *
 * Run after every Natural Earth update: `npm run data:geo`
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import polygonClipping from "polygon-clipping";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// 50m = a good trade-off between coastline detail and file size.
// 110m is 5x smaller but looks jagged when zoomed in on a country.
const SOURCE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";

// Disputed areas (Crimea, the Golan, the Cyprus buffer zone…) exist only at 10m
// detail. They are finer than the base layer, but simplification evens that out.
const DISPUTED_SOURCE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_disputed_areas.geojson";

/** Decimal places to round coordinates to (3 ≈ 110 m precision). */
const PRECISION = 3;

function roundCoords(coords) {
  if (typeof coords[0] === "number") {
    return [Number(coords[0].toFixed(PRECISION)), Number(coords[1].toFixed(PRECISION))];
  }
  return coords.map(roundCoords);
}

/** Natural Earth uses ISO_A3 = "-99" for disputed territories; fall back to ADM0_A3. */
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

/** Splits a MultiPolygon into individual polygons (outer rings). */
function outerRings(geometry) {
  if (geometry.type === "Polygon") return [geometry.coordinates[0]];
  if (geometry.type === "MultiPolygon") return geometry.coordinates.map((polygon) => polygon[0]);
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
 * Bounding box for "zoom to country". Only the largest contiguous landmass is
 * used, so Alaska does not stretch the US box across the Pacific, nor Chukotka Russia's.
 */
function mainlandBbox(geometry) {
  const rings = outerRings(geometry);
  if (!rings.length) return null;
  let best = null;
  let bestArea = -1;
  for (const ring of rings) {
    const [minLon, minLat, maxLon, maxLat] = ringBbox(ring);
    // Area in "degrees", corrected for latitude so Greenland does not win.
    const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
    const area = (maxLon - minLon) * Math.cos(midLat) * (maxLat - minLat);
    if (area > bestArea) {
      bestArea = area;
      best = [minLon, minLat, maxLon, maxLat];
    }
  }
  return best.map((value) => Number(value.toFixed(3)));
}

/* ---------- UN policy ---------- */

const toMulti = (geometry) =>
  geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

const fromMulti = (multi) =>
  multi.length === 1
    ? { type: "Polygon", coordinates: multi[0] }
    : { type: "MultiPolygon", coordinates: multi };

/** Ring area in square degrees – for dropping leftovers after clipping. */
function ringArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return Math.abs(sum / 2);
}

/**
 * Clipping the 50m base against a 10m disputed area leaves thin slivers along
 * the border. Drop everything below ~250 km², far below the map's resolution.
 */
function dropSlivers(multi) {
  const kept = multi.filter((polygon) => ringArea(polygon[0]) > 0.02);
  return kept.length ? kept : multi;
}

function applyUnPolicy(countries, disputed, rules) {
  const byIso = new Map();
  for (const feature of countries) {
    const iso = isoOf(feature.properties ?? {});
    if (iso && !byIso.has(iso)) byIso.set(iso, feature);
  }

  const areaByName = new Map();
  for (const feature of disputed) {
    const p = feature.properties ?? {};
    const name = p.BRK_NAME || p.NAME;
    if (!name) continue;
    const existing = areaByName.get(name);
    // A territory may come in parts (Crimea + Sevastopol) – merge them.
    areaByName.set(
      name,
      existing
        ? fromMulti(polygonClipping.union(toMulti(existing), toMulti(feature.geometry)))
        : feature.geometry,
    );
  }

  const log = [];
  const dropped = new Set();
  /** Disputed status of the territory itself – drawn differently (Kosovo, W. Sahara…). */
  const statusByIso = new Map();
  /** Profile explanation: for transfers and merges it belongs to the receiving state. */
  const noteByIso = new Map();
  const isoOverrides = new Map();
  const labelOverrides = new Map();

  for (const rule of rules) {
    if (rule.action === "transfer") {
      const area = areaByName.get(rule.source);
      const from = byIso.get(rule.from);
      const to = byIso.get(rule.to);
      if (!area || !from || !to) {
        log.push(`  ! ${rule.source}: source data missing, skipping`);
        continue;
      }
      from.geometry = fromMulti(
        dropSlivers(polygonClipping.difference(toMulti(from.geometry), toMulti(area))),
      );
      to.geometry = fromMulti(polygonClipping.union(toMulti(to.geometry), toMulti(area)));
      noteByIso.set(rule.to, rule);
      // When the target is the territory itself (Western Sahara), it carries its
      // own status and name; for Crimea or the Golan the receiving state takes them.
      if (rule.statusOn === "to") statusByIso.set(rule.to, rule.status);
      if (rule.label) labelOverrides.set(to, rule.label);
      log.push(`  ${rule.source}: ${rule.from} → ${rule.to}`);
      continue;
    }

    if (rule.action === "merge") {
      const source = countries.find(
        (feature) => (feature.properties?.NAME || feature.properties?.ADMIN) === rule.source,
      );
      const to = byIso.get(rule.to);
      if (!source || !to) {
        log.push(`  ! ${rule.source}: source data missing, skipping`);
        continue;
      }
      to.geometry = fromMulti(
        polygonClipping.union(toMulti(to.geometry), toMulti(source.geometry)),
      );
      // Population is summed: Natural Earth keeps separate estimates.
      const extra = source.properties?.POP_EST;
      if (typeof extra === "number" && typeof to.properties?.POP_EST === "number") {
        to.properties.POP_EST += extra;
      }
      dropped.add(source);
      noteByIso.set(rule.to, rule);
      log.push(`  ${rule.source} → ${rule.to} (merged)`);
      continue;
    }

    // flag and carve: the feature stays separate and gets a code, name and status.
    // Carve also cuts the territory out of the state administering it – Natural
    // Earth lists it twice, once on its own and once inside the neighbour.
    const target = countries.find((feature) => {
      const p = feature.properties ?? {};
      return (p.NAME || p.ADMIN) === rule.source;
    });
    if (!target) {
      log.push(`  ! ${rule.source}: not in source data, skipping`);
      continue;
    }
    const current = isoOf(target.properties ?? {});
    if (rule.action === "carve") {
      const host = byIso.get(rule.from);
      if (host) {
        host.geometry = fromMulti(
          dropSlivers(polygonClipping.difference(toMulti(host.geometry), toMulti(target.geometry))),
        );
        log.push(`  ${rule.source}: carved out of ${rule.from}`);
      } else {
        log.push(`  ! ${rule.source}: ${rule.from} not in source data`);
      }
    }
    if (rule.iso3 && current !== rule.iso3) isoOverrides.set(target, rule.iso3);
    if (rule.label) labelOverrides.set(target, rule.label);
    statusByIso.set(rule.iso3 ?? current, rule.status);
    noteByIso.set(rule.iso3 ?? current, rule);
    log.push(`  ${rule.source}: ${current} → ${rule.iso3 ?? current} (${rule.status})`);
  }

  return {
    features: countries.filter((feature) => !dropped.has(feature)),
    statusByIso,
    noteByIso,
    isoOverrides,
    labelOverrides,
    log,
  };
}

async function main() {
  process.stdout.write(`Downloading ${SOURCE}\n`);
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`Natural Earth returned ${res.status}`);
  const raw = await res.json();

  process.stdout.write(`Downloading disputed areas\n`);
  const disputedRes = await fetch(DISPUTED_SOURCE);
  if (!disputedRes.ok) throw new Error(`Disputed areas returned ${disputedRes.status}`);
  const disputedRaw = await disputedRes.json();

  const rules = JSON.parse(await readFile(resolve(ROOT, "src/data/territories.json"), "utf8"));

  process.stdout.write("Applying UN policy:\n");
  const policy = applyUnPolicy(raw.features, disputedRaw.features, rules);
  process.stdout.write(`${policy.log.join("\n")}\n`);

  const features = [];
  const labels = [];
  const countries = [];

  for (const feature of policy.features) {
    const p = feature.properties ?? {};
    const iso3 = policy.isoOverrides.get(feature) ?? isoOf(p);
    if (!iso3) continue;

    // NAME is the common short name ("Russia"), FORMAL_EN the official one.
    const name = policy.labelOverrides.get(feature) || p.NAME || p.ADMIN || p.NAME_LONG;
    const slug = slugify(name);
    const bbox = mainlandBbox(feature.geometry);
    const labelLon = p.LABEL_X ?? (bbox ? (bbox[0] + bbox[2]) / 2 : null);
    const labelLat = p.LABEL_Y ?? (bbox ? (bbox[1] + bbox[3]) / 2 : null);
    const status = policy.statusByIso.get(iso3) ?? null;
    const rule = policy.noteByIso.get(iso3);
    const territoryNote = rule ? { status: rule.status, note: rule.note, basis: rule.basis } : null;

    features.push({
      type: "Feature",
      id: iso3,
      properties: status ? { iso3, name, slug, status } : { iso3, name, slug },
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
      status,
      territoryNote,
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
    `Done: ${features.length} countries, ${labels.length} labels, ` +
      `${policy.noteByIso.size} territories with a note.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exit(1);
});
