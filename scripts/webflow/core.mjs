/**
 * Core of the Webflow import (PLAN G7, brief P16) — pure functions with no network
 * or database, so they can be tested on sample data (tests/unit/webflow-import.test.ts).
 *
 * Input is a collection export from Webflow CMS: CSV ("Export" in the CMS) or JSON
 * from Data API v2 (`GET /collections/{id}/items`). Output is rows in the shape
 * the Atlas expects: portrait section items (`replace_portrait_items`),
 * entries (`entries`) and redirects (`redirects`).
 */

import { htmlToText } from "../lib/html.mjs";

/** Hosts Webflow serves uploaded files from — these are downloaded into Storage. */
export const WEBFLOW_FILE_HOSTS = [
  "website-files.com",
  "uploads-ssl.webflow.com",
  "assets.website-files.com",
  "cdn.prod.website-files.com",
];

// ---------------------------------------------------------------------------
// Reading the export
// ---------------------------------------------------------------------------

/** CSV per RFC 4180 (quotes, doubled quotes, newlines inside a field, BOM). */
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

/** Item field key from the CSV column name or the API field slug (`Main Image` ~ `main-image`). */
function keyOf(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Collection items from the export. Drafts and archived items are skipped —
 * only what is published in Webflow belongs on the site.
 * Returns `{ id, slug, name, fields }`, where `fields` has slug-shaped keys.
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
// Field mapping helpers
// ---------------------------------------------------------------------------

/** Field value as text; flattens an API image (`{ url }`) and a list (`[..]`). */
export function text(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(", ");
  if (typeof value === "object") return String(value.url ?? value.name ?? "");
  return String(value).trim();
}

/** Plain text from rich text (for a summary, FAQ answer…). */
export function plain(html) {
  return htmlToText(text(html), { lineBreaks: true })
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Truncates text to the DB column limit (at a whole word, with an ellipsis). */
export function clip(value, max) {
  const source = text(value);
  if (source.length <= max) return source;
  const cut = source.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 40))}…`;
}

/** Date from Webflow ("Wed Mar 05 2025 …", ISO) → `YYYY-MM-DD`, otherwise null. */
export function isoDate(value) {
  const source = text(value);
  if (!source) return null;
  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/** Slug per Atlas rules (lowercase letters without diacritics, digits, hyphens). */
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

/** YouTube video IDs in text or an embed (each once, in order of appearance). */
export function youtubeIds(value) {
  const ids = [...text(value).matchAll(YOUTUBE)].map((match) => match[1]);
  return [...new Set(ids)];
}

/** A YouTube video as a "Videos & Documentaries" resource (P16). */
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

/** Is this a Webflow CDN file that should be downloaded into Storage? */
export function isWebflowFile(url) {
  try {
    const host = new URL(url).hostname;
    return WEBFLOW_FILE_HOSTS.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

/** All Webflow CDN file URLs in a value (src/href attributes and bare URLs). */
export function webflowFiles(value) {
  const found = text(value).match(/https:\/\/[^\s"'()<>]+/g) ?? [];
  return [...new Set(found.filter(isWebflowFile))];
}

/**
 * Replaces Webflow CDN file URLs with new ones (Storage) using the map
 * `old → new`. Images on `website-files.com` are not hotlinked (P16).
 */
export function rewriteFiles(value, map) {
  let result = text(value);
  for (const [from, to] of map) result = result.split(from).join(to);
  return result;
}

// ---------------------------------------------------------------------------
// Collection mapping
// ---------------------------------------------------------------------------

/** Where a collection is stored (same names as `replace_portrait_items`). */
export const PORTRAIT_COLLECTIONS = ["timeline", "faq", "resources", "visuals", "metrics"];

/**
 * Converts collection items according to its entry in the config.
 * `collection.map(item, helpers)` returns one row, an array of rows, or null
 * (the item is skipped). Returns `{ rows, skipped }`.
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
 * Redirects of old URLs: fixed pairs from the config and per-collection patterns
 * (`/post/{slug}` → `/news/{slug}`). For a duplicate `from` the first wins; a path
 * pointing to itself is skipped (the DB would reject it).
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

/** Path without domain, with a leading and no trailing slash (matching the CHECK on redirects). */
export function normalizePath(value) {
  let path = text(value);
  try {
    if (/^https?:\/\//.test(path)) path = new URL(path).pathname;
  } catch {
    /* leave as is — the DB may reject it */
  }
  path = `/${path.replace(/^\/+/, "")}`;
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}
