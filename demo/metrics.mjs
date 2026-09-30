import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Vyrobí `demo/atlas-metrics.js` – surové hodnoty ukazatelů pro ukázku.
 *
 * Proč surové: ukázka si barvy počítá sama, aby šla v administraci měnit
 * paleta, sytost i rozsah škály. Předpočítané barvy z `atlas-data.js`
 * (`colorSets`) to neumožňují, protože v nich je jen výsledek.
 *
 * Ke každému ukazateli se přidává popis – v aplikaci zatím nikde není,
 * ale v panelu země i v administraci je to to první, co člověk hledá.
 *
 * Použití: npm run demo:metrics
 */
const dir = dirname(fileURLToPath(import.meta.url));
const source = JSON.parse(
  readFileSync(join(dir, "..", "src", "data", "indicators.generated.json"), "utf8"),
);

/** Co ukazatel vlastně měří, jednou dvěma větami. */
const DESCRIPTIONS = {
  "hdi":
    "A single score from 0 to 1 combining life expectancy, years of schooling and income per head. " +
    "It asks one question: how far does a country turn its resources into long, educated, decent lives?",
  "life-expectancy":
    "How many years a child born today would live if today's mortality rates held for their whole life. " +
    "The most sensitive single reading of a country's health, its wars and its poverty.",
  "gdp-per-capita":
    "Economic output per person, adjusted for what money actually buys locally. " +
    "Drawn on a logarithmic scale, because the step from $1,000 to $2,000 changes a life as much as $40,000 to $80,000.",
  "political-regime":
    "Four categories from the Regimes of the World classification: whether elections happen, " +
    "whether they are free, and whether power is checked once it has been won.",
  "democracy-index":
    "V-Dem's electoral democracy index from 0 to 1: how far elections are free and fair, and how far " +
    "speech, press and association are protected in the years between them.",
  "corruption":
    "Expert and business perceptions of corruption in the public sector, from 0 (highly corrupt) to " +
    "100 (very clean). It measures perception, not convictions.",
  "extreme-poverty":
    "Share of people living on less than $2.15 a day at 2017 prices — the international line for extreme poverty.",
  "co2-per-capita":
    "Tonnes of CO₂ from fossil fuels and industry per resident per year. Counted where goods are made, " +
    "not where they are consumed, so exporting economies carry the emissions of their customers.",
  "internet-users":
    "Share of the population that used the internet in the past three months — the closest available " +
    "reading of who takes part in the digital public sphere.",
};

const out = {};
for (const [id, metric] of Object.entries(source)) {
  out[id] = { ...metric, description: DESCRIPTIONS[id] || "" };
}

const json = JSON.stringify(out);
writeFileSync(join(dir, "atlas-metrics.js"), `window.ATLAS_METRICS=${json};\n`, "utf8");

const missing = Object.keys(out).filter((id) => !out[id].description);
console.log(
  `demo/atlas-metrics.js · ${Object.keys(out).length} ukazatelů · ` +
    `${(json.length / 1024).toFixed(0)} kB` +
    (missing.length ? ` · bez popisu: ${missing.join(", ")}` : ""),
);
