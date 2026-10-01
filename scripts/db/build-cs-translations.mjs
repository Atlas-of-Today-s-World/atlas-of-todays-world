// One-off generator of the migration with Czech names (G5): countries from Unicode
// CLDR (Intl.DisplayNames by ISO 3166-1 alpha-2), regions, global issues and
// indicators by hand. Output: supabase/migrations/20261001000003_translations_cs.sql.
// Translations can still be edited in the admin (Překlady); the migration overwrites nothing.
import { readFileSync, writeFileSync } from "node:fs";

const countries = JSON.parse(readFileSync("src/data/countries.generated.json", "utf8"));
const names = new Intl.DisplayNames(["cs"], { type: "region" });

const REGIONS = {
  "eastern-europe-central-asia": "Východní Evropa a Střední Asie",
  "western-central-europe": "Západní a střední Evropa",
  "middle-east-north-africa": "Blízký východ a severní Afrika",
  "sub-saharan-africa": "Subsaharská Afrika",
  "south-asia": "Jižní Asie",
  "east-asia": "Východní Asie",
  "southeast-asia-oceania": "Jihovýchodní Asie a Oceánie",
  "north-america": "Severní Amerika",
  "latin-america-caribbean": "Latinská Amerika a Karibik",
};
const REGION_TAGLINE = "Komplexní portrét v globální perspektivě";

const ISSUES = {
  "russia-ukraine-war": ["Válka Ruska proti Ukrajině", "Válka a státy, které proměnila"],
  "forced-displacement": ["Nucené vysídlení", "Odkud lidé prchají a kam přicházejí"],
  "climate-frontlines": ["Klimatická fronta", "Státy, pro které je klima už bezpečnostní otázkou"],
  "energy-transition": ["Energetická transformace", "Producenti, odběratelé a nerosty mezi nimi"],
  "food-insecurity": ["Potravinová nejistota", "Kde je hlad výsledkem politiky, ne neúrody"],
  "migration-routes": ["Migrační trasy", "Koridory, kudy lidé skutečně putují"],
};

const INDICATORS = {
  hdi: ["Index lidského rozvoje", "HDI"],
  "life-expectancy": ["Naděje dožití při narození", "Naděje dožití"],
  "gdp-per-capita": ["HDP na obyvatele (PPP, int. $)", "HDP na obyvatele"],
  "political-regime": ["Politický režim", "Politický režim"],
  "democracy-index": ["Index volební demokracie", "Demokracie"],
  corruption: ["Index vnímání korupce", "Korupce"],
  "extreme-poverty": ["Obyvatelé v extrémní chudobě", "Extrémní chudoba"],
  "co2-per-capita": ["Emise CO₂ na obyvatele", "CO₂ na obyvatele"],
  "internet-users": ["Podíl obyvatel používajících internet", "Uživatelé internetu"],
};

const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const rows = [];
for (const country of countries) {
  if (!/^[A-Z]{2}$/.test(country.iso2 ?? "")) continue;
  let cs;
  try {
    cs = names.of(country.iso2);
  } catch {
    continue; // invalid code (e.g. "-99" for disputed territories in Natural Earth)
  }
  // CLDR returns the code when it does not know the name — such a row is pointless.
  if (!cs || cs === country.iso2 || cs === country.name) continue;
  rows.push(["country", country.iso3, "name", cs]);
}
for (const [slug, name] of Object.entries(REGIONS)) {
  rows.push(["region", slug, "name", name], ["region", slug, "tagline", REGION_TAGLINE]);
}
for (const [slug, [name, subtitle]] of Object.entries(ISSUES)) {
  rows.push(["issue", slug, "name", name], ["issue", slug, "subtitle", subtitle]);
}
for (const [id, [label, short]] of Object.entries(INDICATORS)) {
  rows.push(["indicator", id, "label", label], ["indicator", id, "short_label", short]);
}

const values = rows
  .map(
    ([entity, key, field, value]) => `  (${q(entity)}, ${q(key)}, ${q(field)}, 'cs', ${q(value)})`,
  )
  .join(",\n");

const sql = `-- G5: české názvy států (Unicode CLDR), regionů, globálních témat a ukazatelů.
-- Vygenerováno scripts/db/build-cs-translations.mjs. Nic nepřepisuje: co redakce
-- přeložila jinak, zůstává (on conflict do nothing). Upravuje se v administraci.

insert into public.translations (entity, entity_key, field, locale, value) values
${values}
on conflict (entity, entity_key, field, locale) do nothing;
`;
writeFileSync("supabase/migrations/20261001000003_translations_cs.sql", sql);
console.log(`${rows.length} translations`);
