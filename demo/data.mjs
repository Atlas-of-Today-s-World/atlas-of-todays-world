import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Stáhne obsah Atlasu z běžící aplikace do `demo/atlas-data.js`.
 * Předpokládá spuštěné `npm run dev` (jiný port se dá předat argumentem).
 *
 * Použití: npm run demo:data
 */
const dir = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] || "http://localhost:3000";

const response = await fetch(`${base}/api/export-demo`);
if (!response.ok) {
  throw new Error(`export-demo vrátil ${response.status} – běží vývojový server?`);
}

const json = await response.text();
const data = JSON.parse(json);
writeFileSync(join(dir, "atlas-data.js"), `window.ATLAS_DATA=${json};\n`, "utf8");

console.log(
  `demo/atlas-data.js · ${data.countries.length} zemí · ${data.regions.length} regionů · ` +
    `${data.specials.length} vlastních celků · ${data.newsItems.length} novinek`,
);
