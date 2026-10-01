/**
 * Jádro importu z Webflow (PLAN G7, brief P16) — čisté funkce bez sítě a
 * databáze, ať se dají otestovat na ukázkových datech (tests/unit/webflow-import.test.ts).
 *
 * Vstup je export kolekce z Webflow CMS: CSV („Export" v CMS) nebo JSON
 * z Data API v2 (`GET /collections/{id}/items`). Výstup jsou řádky v tvaru,
 * který čeká Atlas: položky sekcí portrétu (`replace_portrait_items`),
 * články (`entries`) a přesměrování (`redirects`).
 */

/** Hostitelé, ze kterých Webflow servíruje nahrané soubory — ty se stáhnou do Storage. */
export const WEBFLOW_FILE_HOSTS = [
  "website-files.com",
  "uploads-ssl.webflow.com",
  "assets.website-files.com",
  "cdn.prod.website-files.com",
];

// ---------------------------------------------------------------------------
// Čtení exportu
// ---------------------------------------------------------------------------

/** CSV podle RFC 4180 (uvozovky, zdvojené uvozovky, nové řádky v poli, BOM). */
export function parseCsv(text) {
  const source = text.replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header = [], ...body] = rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
  return body.map((cells) =>
    Object.fromEntries(header.map((name, i) => [name.trim(), cells[i] ?? ""])),
  );
}

/** Pole položky podle názvu sloupce v CSV i podle slugu pole v API (`Main Image` ~ `main-image`). */
function keyOf(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Položky kolekce z exportu. Koncepty a archivované položky se vynechají —
 * na web patří jen to, co je ve Webflow zveřejněné.
 * Vrací `{ id, slug, name, fields }`, kde `fields` jsou klíče ve tvaru slugu.
 */
export function readItems(text, format) {
  const raw =
    format === "csv"
      ? parseCsv(text).map((row) => ({
          id: row["Item ID"] ?? "",
          draft: /^true$/i.test(row.Draft ?? row["_draft"] ?? ""),
          archived: /^true$/i.test(row.Archived ?? row["_archived"] ?? ""),
          fields: Object.fromEntries(
            Object.entries(row).map(([key, value]) => [keyOf(key), value]),
          ),
        }))
      : (JSON.parse(text).items ?? []).map((item) => ({
          id: item.id ?? "",
          draft: Boolean(item.isDraft),
          archived: Boolean(item.isArchived),
          fields: Object.fromEntries(
            Object.entries({
              ...(item.fieldData ?? {}),
              "published-on": item.lastPublished ?? item.fieldData?.["published-on"] ?? "",
            }).map(([key, value]) => [keyOf(key), value]),
          ),
        }));
  return raw
    .filter((item) => !item.draft && !item.archived)
    .map((item) => ({
      id: item.id,
      slug: String(item.fields.slug ?? ""),
      name: String(item.fields.name ?? ""),
      fields: item.fields,
    }));
}

// ---------------------------------------------------------------------------
// Pomocníci pro mapování polí
// ---------------------------------------------------------------------------

/** Hodnota pole jako text; obrázek z API (`{ url }`) i seznam (`[..]`) zploští. */
export function text(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(", ");
  if (typeof value === "object") return String(value.url ?? value.name ?? "");
  return String(value).trim();
}

/** Prostý text z rich textu (pro perex, odpověď FAQ…). */
export function plain(html) {
  return text(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Zkrátí text na limit sloupce v DB (na celé slovo, se třemi tečkami). */
export function clip(value, max) {
  const source = text(value);
  if (source.length <= max) return source;
  const cut = source.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 40))}…`;
}

/** Datum z Webflow („Wed Mar 05 2025 …", ISO) → `YYYY-MM-DD`, jinak null. */
export function isoDate(value) {
  const source = text(value);
  if (!source) return null;
  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/** Slug podle pravidel Atlasu (malá písmena bez diakritiky, číslice, pomlčky). */
export function slugify(value) {
  return text(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

const YOUTUBE =
  /(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/g;

/** ID videí z YouTube v textu nebo vložení (každé jen jednou, v pořadí výskytu). */
export function youtubeIds(value) {
  const ids = [...text(value).matchAll(YOUTUBE)].map((match) => match[1]);
  return [...new Set(ids)];
}

/** Video z YouTube jako zdroj „Videos & Documentaries" (P16). */
export function youtubeResource(id, title, source = "YouTube") {
  return {
    kind: "Videos & Documentaries",
    title: clip(title || "Video", 200),
    source,
    description: "",
    url: `https://www.youtube.com/watch?v=${id}`,
    image_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}

/** Je to soubor z Webflow CDN, který patří stáhnout do Storage? */
export function isWebflowFile(url) {
  try {
    const host = new URL(url).hostname;
    return WEBFLOW_FILE_HOSTS.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

/** Všechny adresy souborů z Webflow CDN v hodnotě (atributy src/href i holé URL). */
export function webflowFiles(value) {
  const found = text(value).match(/https:\/\/[^\s"'()<>]+/g) ?? [];
  return [...new Set(found.filter(isWebflowFile))];
}

/**
 * Nahradí adresy souborů z Webflow CDN novými (Storage) podle mapy
 * `staré → nové`. Obrázky na `website-files.com` se nelinkují (P16).
 */
export function rewriteFiles(value, map) {
  let result = text(value);
  for (const [from, to] of map) result = result.split(from).join(to);
  return result;
}

// ---------------------------------------------------------------------------
// Mapování kolekcí
// ---------------------------------------------------------------------------

/** Kam se kolekce ukládá (stejné názvy jako `replace_portrait_items`). */
export const PORTRAIT_COLLECTIONS = ["timeline", "faq", "resources", "visuals", "metrics"];

/**
 * Převede položky kolekce podle jejího záznamu v konfiguraci.
 * `collection.map(item, helpers)` vrací jeden řádek, pole řádků, nebo null
 * (položka se přeskočí). Vrací `{ rows, skipped }`.
 */
export function mapCollection(items, collection) {
  const rows = [];
  const skipped = [];
  for (const item of items) {
    const mapped = collection.map(item, HELPERS);
    if (mapped == null) skipped.push(item.slug || item.id);
    else rows.push(...(Array.isArray(mapped) ? mapped : [mapped]));
  }
  return { rows, skipped };
}

export const HELPERS = { text, plain, clip, isoDate, slugify, youtubeIds, youtubeResource };

/**
 * Přesměrování starých adres: pevné páry z konfigurace a vzory podle kolekce
 * (`/post/{slug}` → `/news/{slug}`). Duplicitní `from` vyhraje první, cesta
 * sama na sebe se vynechá (DB by ji odmítla).
 */
export function buildRedirects(config, itemsByCollection) {
  const pairs = [...(config.redirects ?? [])];
  for (const collection of config.collections ?? []) {
    if (!collection.oldPath || !collection.newPath) continue;
    for (const item of itemsByCollection.get(collection.name) ?? []) {
      if (!item.slug) continue;
      const slug = collection.slugOf ? collection.slugOf(item, HELPERS) : item.slug;
      pairs.push({
        from: collection.oldPath.replace("{slug}", item.slug),
        to: collection.newPath.replace("{slug}", slug),
      });
    }
  }
  const seen = new Set();
  return pairs
    .map(({ from, to, permanent = true }) => ({
      from_path: normalizePath(from),
      to_path: normalizePath(to),
      permanent,
    }))
    .filter((row) => {
      if (row.from_path === row.to_path || seen.has(row.from_path)) return false;
      seen.add(row.from_path);
      return true;
    });
}

/** Cesta bez domény, s úvodním a bez koncového lomítka (shodně s CHECK v tabulce redirects). */
export function normalizePath(value) {
  let path = text(value);
  try {
    if (/^https?:\/\//.test(path)) path = new URL(path).pathname;
  } catch {
    /* necháme, jak je — DB případně odmítne */
  }
  path = `/${path.replace(/^\/+/, "")}`;
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}
