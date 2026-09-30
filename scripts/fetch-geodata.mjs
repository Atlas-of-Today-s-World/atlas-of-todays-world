#!/usr/bin/env node
/**
 * Stahuje a zjednodušuje hranice zemí z Natural Earth do public/data/.
 *
 * Výstupy:
 *   public/data/countries.geo.json      – hranice pro mapu (jen potřebné properties)
 *   public/data/country-labels.geo.json – bodová vrstva popisků (1 bod = 1 země)
 *   src/data/countries.generated.json   – číselník zemí pro server (bez geometrie)
 *
 * Natural Earth kreslí hranice „de facto": Krym vede u Ruska, Golany u Izraele,
 * Severní Kypr a Somaliland jako samostatné jednotky. Atlas se drží praxe OSN,
 * takže se na stažená data použije předpis ze `src/data/territories.json` –
 * území se převedou, slijí nebo jen označí. Redakční rozhodnutí bydlí tam,
 * tady je jen jeho provedení.
 *
 * Spouštěj po každé aktualizaci Natural Earth: `npm run data:geo`
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import polygonClipping from "polygon-clipping";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// 50m = dobrý kompromis mezi detailem pobřeží a velikostí souboru.
// 110m je 5x menší, ale při zoomu na zemi vypadá hranatě.
const SOURCE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";

// Sporné plochy (Krym, Golany, nárazníková zóna na Kypru…) jsou jen v 10m
// podrobnosti. Jsou jemnější než podklad, ale zjednodušení to zarovná.
const DISPUTED_SOURCE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_disputed_areas.geojson";

/** Na kolik desetinných míst zaokrouhlit souřadnice (3 ≈ 110 m přesnost). */
const PRECISION = 3;

function roundCoords(coords) {
  if (typeof coords[0] === "number") {
    return [Number(coords[0].toFixed(PRECISION)), Number(coords[1].toFixed(PRECISION))];
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

/* ---------- předpis OSN ---------- */

const toMulti = (geometry) =>
  geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

const fromMulti = (multi) =>
  multi.length === 1
    ? { type: "Polygon", coordinates: multi[0] }
    : { type: "MultiPolygon", coordinates: multi };

/** Plocha prstence ve čtverečních stupních – k zahození zbytků po řezu. */
function ringArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return Math.abs(sum / 2);
}

/**
 * Po řezu mezi 50m podkladem a 10m spornou plochou zůstávají u hranice tenké
 * třísky. Zahodíme všechno pod ~250 km², což je hluboko pod rozlišením mapy.
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
    // Území může přijít po částech (Krym + Sevastopol) – sloučíme je.
    areaByName.set(
      name,
      existing
        ? fromMulti(polygonClipping.union(toMulti(existing), toMulti(feature.geometry)))
        : feature.geometry,
    );
  }

  const log = [];
  const dropped = new Set();
  /** Sporný status samotného území – kreslí se jinak (Kosovo, Z. Sahara…). */
  const statusByIso = new Map();
  /** Vysvětlení do profilu: u převodů a slití patří státu, který území přebírá. */
  const noteByIso = new Map();
  const isoOverrides = new Map();
  const labelOverrides = new Map();

  for (const rule of rules) {
    if (rule.action === "transfer") {
      const area = areaByName.get(rule.source);
      const from = byIso.get(rule.from);
      const to = byIso.get(rule.to);
      if (!area || !from || !to) {
        log.push(`  ! ${rule.source}: chybí podklad, přeskakuji`);
        continue;
      }
      from.geometry = fromMulti(
        dropSlivers(polygonClipping.difference(toMulti(from.geometry), toMulti(area))),
      );
      to.geometry = fromMulti(polygonClipping.union(toMulti(to.geometry), toMulti(area)));
      noteByIso.set(rule.to, rule);
      // Když je cílem samotné území (Západní Sahara), nese si i svůj status
      // a jméno; u Krymu nebo Golan si je bere stát, který území přebírá.
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
        log.push(`  ! ${rule.source}: chybí podklad, přeskakuji`);
        continue;
      }
      to.geometry = fromMulti(
        polygonClipping.union(toMulti(to.geometry), toMulti(source.geometry)),
      );
      // Obyvatelstvo se sčítá: Natural Earth vede odhady zvlášť.
      const extra = source.properties?.POP_EST;
      if (typeof extra === "number" && typeof to.properties?.POP_EST === "number") {
        to.properties.POP_EST += extra;
      }
      dropped.add(source);
      noteByIso.set(rule.to, rule);
      log.push(`  ${rule.source} → ${rule.to} (sloučeno)`);
      continue;
    }

    // flag a carve: prvek zůstává samostatný, dostane kód, jméno a status.
    // Carve k tomu vyřízne území ze státu, který ho spravuje – Natural Earth
    // ho totiž vede dvakrát, jednou zvlášť a jednou uvnitř souseda.
    const target = countries.find((feature) => {
      const p = feature.properties ?? {};
      return (p.NAME || p.ADMIN) === rule.source;
    });
    if (!target) {
      log.push(`  ! ${rule.source}: v podkladu není, přeskakuji`);
      continue;
    }
    const current = isoOf(target.properties ?? {});
    if (rule.action === "carve") {
      const host = byIso.get(rule.from);
      if (host) {
        host.geometry = fromMulti(
          dropSlivers(polygonClipping.difference(toMulti(host.geometry), toMulti(target.geometry))),
        );
        log.push(`  ${rule.source}: vyříznuto z ${rule.from}`);
      } else {
        log.push(`  ! ${rule.source}: ${rule.from} v podkladu není`);
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
  process.stdout.write(`Stahuji ${SOURCE}\n`);
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`Natural Earth vrátil ${res.status}`);
  const raw = await res.json();

  process.stdout.write(`Stahuji sporné plochy\n`);
  const disputedRes = await fetch(DISPUTED_SOURCE);
  if (!disputedRes.ok) throw new Error(`Sporné plochy vrátily ${disputedRes.status}`);
  const disputedRaw = await disputedRes.json();

  const rules = JSON.parse(await readFile(resolve(ROOT, "src/data/territories.json"), "utf8"));

  process.stdout.write("Používám předpis OSN:\n");
  const policy = applyUnPolicy(raw.features, disputedRaw.features, rules);
  process.stdout.write(`${policy.log.join("\n")}\n`);

  const features = [];
  const labels = [];
  const countries = [];

  for (const feature of policy.features) {
    const p = feature.properties ?? {};
    const iso3 = policy.isoOverrides.get(feature) ?? isoOf(p);
    if (!iso3) continue;

    // NAME je běžný krátký název ("Russia"), FORMAL_EN oficiální.
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
    `Hotovo: ${features.length} zemí, ${labels.length} popisků, ` +
      `${policy.noteByIso.size} území s poznámkou.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exit(1);
});
