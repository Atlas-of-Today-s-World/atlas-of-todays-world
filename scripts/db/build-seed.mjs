import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { REGIONS } from "../../src/data/regions.ts";

/**
 * Vyrobí `supabase/seed.sql` z obsahu, který dnes žije v souborech.
 *
 * Co se převádí: 9 regionů, země z Natural Earth (včetně poznámek o sporných
 * územích), 9 ukazatelů z Our World in Data s hodnotami, global issues jako
 * vlastní celky, portréty regionů (osa, otázky, zdroje, obrázky, ruční
 * ukazatele), doplňky zemí a novinky.
 *
 * Co se NEpřevádí: ukázkový text z `demo/atlas-filled.js` — je vymyšlený pro
 * prezentaci a do ostré databáze nepatří.
 *
 * Seed jde pustit opakovaně. Regiony, země a ukazatele se aktualizují; ruční
 * hodnoty ukazatelů, články a obsah portrétů, které už existují, zůstanou.
 *
 * Použití: npm run db:seed  (zapíše supabase/seed.sql)
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const json = (path) => JSON.parse(read(path));

const warnings = [];
const out = [];
const emit = (sql) => out.push(sql);

/* ---------- SQL literály ---------- */

function lit(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  return "'" + String(value).replace(/'/g, "''") + "'";
}
const textArray = (items) => (items && items.length ? "array[" + items.map(lit).join(", ") + "]::text[]" : "'{}'::text[]");
const numArray = (items) => (items && items.length ? "array[" + items.map(lit).join(", ") + "]::numeric[]" : "null");
/** Stálé id z textu: seed jde spustit znovu, aniž by vznikly kopie. */
const stableId = (key) => `md5(${lit(key)})::uuid`;

function rows(table, columns, values, conflict) {
  if (!values.length) return;
  const chunk = 400;
  for (let i = 0; i < values.length; i += chunk) {
    emit(`insert into public.${table} (${columns.join(", ")}) values\n  ` +
      values.slice(i, i + chunk).map((row) => "(" + row.join(", ") + ")").join(",\n  ") +
      `\n${conflict};`);
  }
}

/* ---------- čištění HTML (stejná zásada jako src/lib/content.ts) ---------- */

const cleanHtml = (html) => sanitizeHtml(html, {
  allowedTags: ["h2", "h3", "h4", "p", "br", "hr", "strong", "em", "b", "i", "u", "blockquote",
    "ul", "ol", "li", "a", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "code", "pre"],
  allowedAttributes: { a: ["href", "title"], img: ["src", "alt", "title"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noreferrer noopener" }) },
});

/* ---------- regiony ---------- */

const regionOf = new Map();
for (const region of REGIONS) region.countries.forEach((iso3) => regionOf.set(iso3, region.slug));

rows("regions",
  ["slug", "name", "tagline", "fill", "stroke", "center_lon", "center_lat", "zoom", "summary", "position"],
  REGIONS.map((r, index) => [lit(r.slug), lit(r.name), lit(r.tagline), lit(r.fill.toLowerCase()),
    lit(r.stroke.toLowerCase()), lit(r.center[0]), lit(r.center[1]), lit(r.zoom), lit(r.summary), lit(index)]),
  `on conflict (slug) do update set name = excluded.name, tagline = excluded.tagline, fill = excluded.fill,
  stroke = excluded.stroke, center_lon = excluded.center_lon, center_lat = excluded.center_lat,
  zoom = excluded.zoom, summary = excluded.summary, position = excluded.position`);

/* ---------- země ---------- */

const countries = json("src/data/countries.generated.json");
const known = new Set(countries.map((c) => c.iso3));
for (const [iso3, slug] of regionOf) {
  if (!known.has(iso3)) warnings.push(`region ${slug} uvádí ${iso3}, které v datech zemí není — přeskočeno`);
}

const noteOf = (territory) => {
  if (!territory) return null;
  if (typeof territory === "string") return territory;
  return [territory.note, territory.basis ? "Basis: " + territory.basis + "." : null].filter(Boolean).join(" ");
};

rows("countries",
  ["iso3", "slug", "name", "name_formal", "region_slug", "un_subregion", "population", "lon", "lat", "bbox", "territory_note"],
  countries.map((c) => [lit(c.iso3), lit(c.slug), lit(c.name), lit(c.nameFormal), lit(regionOf.get(c.iso3) || null),
    lit(c.unSubregion), lit(c.population), lit(c.labelLon), lit(c.labelLat), numArray(c.bbox), lit(noteOf(c.territoryNote))]),
  `on conflict (iso3) do update set slug = excluded.slug, name = excluded.name, name_formal = excluded.name_formal,
  region_slug = excluded.region_slug, un_subregion = excluded.un_subregion, population = excluded.population,
  lon = excluded.lon, lat = excluded.lat, bbox = excluded.bbox,
  territory_note = coalesce(countries.territory_note, excluded.territory_note)`);

/* ---------- ukazatele ---------- */

const indicators = json("src/data/indicators.generated.json");
let descriptions = {};
if (existsSync(join(root, "demo", "atlas-metrics.js"))) {
  const text = read("demo/atlas-metrics.js").replace(/^window\.ATLAS_METRICS=/, "").replace(/;\s*$/, "");
  descriptions = Object.fromEntries(Object.entries(JSON.parse(text)).map(([id, m]) => [id, m.description || ""]));
}

rows("indicators",
  ["id", "label", "short_label", "description", "unit", "decimals", "source", "source_url", "type", "scale",
    "domain_min", "domain_max", "ramp", "higher_is_better", "latest_year", "is_custom"],
  Object.values(indicators).map((m) => [lit(m.id), lit(m.label), lit(m.shortLabel || ""), lit(descriptions[m.id] || ""),
    lit(m.unit || ""), lit(m.decimals ?? 1), lit(m.source || ""), lit(m.sourceUrl || null), lit(m.type || "sequential"),
    lit(m.scale === "log" ? "log" : "linear"), lit(m.domain ? m.domain[0] : null), lit(m.domain ? m.domain[1] : null),
    textArray((m.ramp || []).map((c) => c.toLowerCase())), lit(m.higherIsBetter !== false), lit(m.latestYear ?? null), "false"]),
  `on conflict (id) do update set label = excluded.label, short_label = excluded.short_label,
  description = case when indicators.description = '' then excluded.description else indicators.description end,
  unit = excluded.unit, decimals = excluded.decimals, source = excluded.source, source_url = excluded.source_url,
  type = excluded.type, scale = excluded.scale, domain_min = excluded.domain_min, domain_max = excluded.domain_max,
  ramp = excluded.ramp, higher_is_better = excluded.higher_is_better, latest_year = excluded.latest_year`);

const categoryRows = [];
const valueRows = [];
for (const m of Object.values(indicators)) {
  for (const c of m.categories || []) {
    categoryRows.push([lit(m.id), lit(c.value), lit(c.label), lit(c.color.toLowerCase())]);
  }
  for (const [iso3, v] of Object.entries(m.values || {})) {
    if (!known.has(iso3)) continue;   // souhrny OWID („World", „Europe") nejsou země
    if (v === null || v.value === null || v.value === undefined) continue;
    valueRows.push([lit(m.id), lit(iso3), lit(Number(v.value)), lit(v.year ?? null)]);
  }
}
rows("indicator_categories", ["indicator_id", "value", "label", "color"], categoryRows,
  "on conflict (indicator_id, value) do nothing");
// Ruční hodnotu redakce import nepřepíše.
rows("indicator_values", ["indicator_id", "country_iso3", "value", "year"], valueRows,
  `on conflict (indicator_id, country_iso3) do update set value = excluded.value, year = excluded.year
  where indicator_values.is_manual = false`);

/* ---------- global issues → vlastní celky ---------- */

const issues = json("src/content/global-issues.json");
rows("special_regions", ["slug", "name", "subtitle", "summary", "fill", "stroke", "center_lon", "center_lat", "zoom"],
  issues.map((g) => [lit(g.slug), lit(g.name), lit(g.subtitle || ""), lit(g.summary || ""), lit(g.fill.toLowerCase()),
    lit(g.stroke.toLowerCase()), lit(g.center[0]), lit(g.center[1]), lit(g.zoom ?? 2.6)]),
  "on conflict (slug) do nothing");
rows("special_region_countries", ["special_slug", "country_iso3"],
  issues.flatMap((g) => g.countries.filter((iso3) => {
    if (known.has(iso3)) return true;
    warnings.push(`global issue ${g.slug} uvádí ${iso3}, které v datech zemí není`);
    return false;
  }).map((iso3) => [lit(g.slug), lit(iso3)])),
  "on conflict do nothing");

/* ---------- portréty regionů ---------- */

const RESOURCE_KINDS = new Set(["Videos & Documentaries", "Lectures & Debates", "Articles, Reports & Books",
  "Educational Resources", "Statistics & Infographics"]);
const dossierDir = join(root, "src", "content", "regions");
for (const file of readdirSync(dossierDir).filter((f) => f.endsWith(".json"))) {
  const slug = file.replace(/\.json$/, "");
  const d = JSON.parse(readFileSync(join(dossierDir, file), "utf8"));
  if (!REGIONS.some((r) => r.slug === slug)) {
    warnings.push(`portrét ${file} nepatří žádnému regionu — přeskočeno`);
    continue;
  }

  emit(`update public.regions set
  intro = case when intro = '' then ${lit(d.intro || "")} else intro end,
  timeline_title = coalesce(timeline_title, ${lit(d.timelineTitle || null)}),
  timeline_subtitle = coalesce(timeline_subtitle, ${lit(d.timelineSubtitle || null)}),
  portrait_status = ${lit((d.timeline || []).length || d.intro ? "populated" : "skeleton")}
where slug = ${lit(slug)};`);

  rows("timeline_events", ["id", "region_slug", "position", "date_label", "title", "body"],
    (d.timeline || []).map((t, i) => [stableId(`timeline:${slug}:${i}`), lit(slug), lit(i), lit(t.date), lit(t.title), lit(t.text || "")]),
    "on conflict (id) do nothing");
  rows("faq_items", ["id", "region_slug", "position", "question", "answer"],
    (d.faq || []).map((f, i) => [stableId(`faq:${slug}:${i}`), lit(slug), lit(i), lit(f.question), lit(f.answer)]),
    "on conflict (id) do nothing");
  rows("resources", ["id", "region_slug", "kind", "position", "title", "source", "url", "image_url"],
    (d.resources || []).filter((r) => {
      if (RESOURCE_KINDS.has(r.kind) && /^https:\/\//.test(r.url || "")) return true;
      warnings.push(`zdroj „${r.title}" v ${file} má neznámý druh nebo adresu bez https — přeskočen`);
      return false;
    }).map((r, i) => [stableId(`resource:${slug}:${i}`), lit(slug), lit(r.kind), lit(i), lit(r.title), lit(r.source || ""),
      lit(r.url), lit(r.image || null)]),
    "on conflict (id) do nothing");
  rows("visual_embeds", ["id", "region_slug", "provider", "position", "title", "caption", "url"],
    (d.visuals || []).map((v, i) => [stableId(`visual:${slug}:${i}`), lit(slug),
      lit(/flourish/.test(v.url || v.image || "") ? "flourish" : /worldbank/.test(v.url || v.image || "") ? "worldbank" : "image"),
      lit(i), lit(v.title), lit(v.caption || ""), lit(v.url || v.image)]),
    "on conflict (id) do nothing");
  rows("portrait_metrics", ["id", "region_slug", "position", "value", "label", "description", "source", "source_url"],
    (d.metrics || []).filter((m) => {
      if (m.source) return true;
      warnings.push(`ukazatel „${m.label}" v ${file} nemá zdroj — bez citace se nepublikuje, přeskočen`);
      return false;
    }).map((m, i) => [stableId(`metric:${slug}:${i}`), lit(slug), lit(i), lit(String(m.value)), lit(m.label),
      lit(m.description || ""), lit(m.source), lit(/^https:\/\//.test(m.sourceUrl || "") ? m.sourceUrl : null)]),
    "on conflict (id) do nothing");
}

/* ---------- doplňky zemí ---------- */

const countryDir = join(root, "src", "content", "countries");
if (existsSync(countryDir)) {
  for (const file of readdirSync(countryDir).filter((f) => f.endsWith(".md"))) {
    const slug = file.replace(/\.md$/, "");
    const country = countries.find((c) => c.slug === slug);
    if (!country) {
      warnings.push(`doplněk ${file} nepatří žádné zemi — přeskočen`);
      continue;
    }
    const { data } = matter(read(`src/content/countries/${file}`));
    if (data.summary) {
      emit(`update public.countries set blurb = coalesce(blurb, ${lit(String(data.summary).trim())}) where iso3 = ${lit(country.iso3)};`);
    }
    rows("portrait_metrics", ["id", "country_iso3", "position", "value", "label", "description", "source", "source_url"],
      (data.metrics || []).filter((m) => m.source).map((m, i) => [stableId(`metric:${country.iso3}:${i}`), lit(country.iso3), lit(i),
        lit(String(m.value)), lit(m.label), lit(m.description || ""), lit(m.source),
        lit(/^https:\/\//.test(m.sourceUrl || "") ? m.sourceUrl : null)]),
      "on conflict (id) do nothing");
  }
}

/* ---------- novinky ---------- */

const issueSlugs = new Set(issues.map((g) => g.slug));
const newsDir = join(root, "src", "content", "news");
const entryRows = [];
const entryCountryRows = [];
for (const file of readdirSync(newsDir).filter((f) => f.endsWith(".md"))) {
  const slug = file.replace(/\.md$/, "");
  const { data, content } = matter(read(`src/content/news/${file}`));
  const html = cleanHtml(marked.parse(content, { async: false }));
  const special = data.issue && issueSlugs.has(data.issue) ? data.issue : null;
  if (data.issue && !special) warnings.push(`novinka ${slug} odkazuje na neznámý celek ${data.issue}`);
  entryRows.push([stableId(`entry:${slug}`), lit(slug), "'news'", lit(data.title), lit(data.summary || ""),
    lit(data.category || "Society"), lit(data.region || null), lit(special), lit(html), lit(data.author || null),
    "'published'", lit(data.published || null), lit(data.readingMinutes || null)]);
  for (const iso3 of data.countries || []) {
    if (known.has(iso3)) entryCountryRows.push([stableId(`entry:${slug}`), lit(iso3)]);
  }
}
// Existující článek se nepřepisuje — mohla ho už upravit redakce.
rows("entries", ["id", "slug", "kind", "title", "summary", "category", "region_slug", "special_slug", "body_html",
  "author_name", "status", "published_on", "reading_minutes"], entryRows, "on conflict (slug) do nothing");
rows("entry_countries", ["entry_id", "country_iso3"], entryCountryRows, "on conflict do nothing");

/* ---------- zápis ---------- */

const header = `-- Vygenerováno skriptem scripts/db/build-seed.mjs — neupravovat ručně.
-- Zdroj: src/data/*.generated.json, src/data/regions.ts, src/content/**
-- ${REGIONS.length} regionů · ${countries.length} zemí · ${Object.keys(indicators).length} ukazatelů · ` +
  `${valueRows.length} hodnot · ${issues.length} celků · ${entryRows.length} novinek
`;
writeFileSync(join(root, "supabase", "seed.sql"), header + "\nbegin;\n\n" + out.join("\n\n") + "\n\ncommit;\n", "utf8");

console.log(`supabase/seed.sql · ${REGIONS.length} regionů · ${countries.length} zemí · ${Object.keys(indicators).length} ukazatelů · ` +
  `${valueRows.length} hodnot · ${issues.length} celků · ${entryRows.length} novinek`);
if (warnings.length) console.log("\nUpozornění:\n  " + warnings.join("\n  "));
