#!/usr/bin/env node
/**
 * Hromadný import datových vrstev pro mapu.
 *
 * Zdroj: Our World in Data (CC-BY). Pro každou vrstvu vezme poslední rok,
 * ve kterém má daná země hodnotu, a uloží ji do src/data/indicators.generated.json.
 *
 * Spouštěj jednou za rok (nebo po vydání nových dat): `npm run data:indicators`
 * Když jeden zdroj selže, ostatní se doimportují a skript to vypíše na konci.
 */
import { writeFile, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { INDICATORS } from "./indicators.config.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Kosovo má v OWID vlastní kód, Natural Earth ho vede jako XKX. */
const CODE_ALIASES = { OWID_KOS: "XKX" };

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function importIndicator(indicator) {
  const url = `https://ourworldindata.org/grapher/${indicator.owidSlug}.csv?v=1&csvType=full&useColumnShortNames=true`;
  const res = await fetch(url, { headers: { "User-Agent": "atlas-of-todays-world/0.1" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} pro ${indicator.owidSlug}`);

  const rows = parseCsv(await res.text());
  const header = rows.shift();
  if (!header) throw new Error(`Prázdné CSV pro ${indicator.owidSlug}`);

  const codeIdx = header.indexOf("code");
  const yearIdx = header.indexOf("year");
  const valueIdx = indicator.valueColumn ? header.indexOf(indicator.valueColumn) : 3;
  if (codeIdx < 0 || yearIdx < 0 || valueIdx < 0) {
    throw new Error(`Neznámá struktura CSV u ${indicator.owidSlug}: ${header.join(",")}`);
  }

  /** @type {Record<string, { value: number; year: number }>} */
  const byCountry = {};
  for (const row of rows) {
    const rawCode = row[codeIdx];
    if (!rawCode) continue;
    // Agregáty (World, Europe, ...) nemají ISO3 kód, jen OWID_*.
    if (rawCode.startsWith("OWID_") && !CODE_ALIASES[rawCode]) continue;
    const code = CODE_ALIASES[rawCode] ?? rawCode;
    if (code.length !== 3) continue;

    const year = Number(row[yearIdx]);
    const value = Number(row[valueIdx]);
    if (!Number.isFinite(year) || !Number.isFinite(value) || row[valueIdx] === "") {
      continue;
    }
    const current = byCountry[code];
    if (!current || year > current.year) byCountry[code] = { value, year };
  }

  const years = Object.values(byCountry).map((entry) => entry.year);
  const { valueColumn: _valueColumn, owidSlug, ...meta } = indicator;

  return {
    ...meta,
    owidSlug,
    latestYear: years.length ? Math.max(...years) : null,
    countryCount: Object.keys(byCountry).length,
    values: byCountry,
  };
}

async function main() {
  /** @type {Record<string, unknown>} */
  const out = {};
  const failures = [];

  for (const indicator of INDICATORS) {
    process.stdout.write(`→ ${indicator.id} (${indicator.owidSlug}) ... `);
    try {
      const data = await importIndicator(indicator);
      out[indicator.id] = data;
      process.stdout.write(`${data.countryCount} zemí, poslední rok ${data.latestYear}\n`);
    } catch (error) {
      failures.push(`${indicator.id}: ${error.message}`);
      process.stdout.write(`CHYBA\n`);
    }
  }

  const target = resolve(ROOT, "src/data/indicators.generated.json");
  // Když jeden zdroj spadne, nepřepisujeme ho prázdnou hodnotou – necháme starou.
  try {
    const previous = JSON.parse(await readFile(target, "utf8"));
    for (const [key, value] of Object.entries(previous)) {
      if (!out[key]) out[key] = value;
    }
  } catch {
    /* první běh, žádná předchozí data */
  }

  await writeFile(target, `${JSON.stringify(out, null, 0)}\n`);
  process.stdout.write(`\nUloženo do ${target}\n`);

  if (failures.length) {
    process.stdout.write(`\nNepodařilo se:\n${failures.map((f) => `  - ${f}`).join("\n")}\n`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exit(1);
});
