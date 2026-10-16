#!/usr/bin/env node
/**
 * Downloads the map labels' glyphs (SDF font ranges in .pbf) from
 * fonts.openmaptiles.org into public/data/glyphs/, so the globe's labels come
 * from our own origin: no extra connection to a third party before the first
 * label, the same caching as the borders, and one host fewer that learns who
 * looks at the map.
 *
 * Only the ranges labels use are kept (src/data/glyphs.json: Basic Latin and
 * Latin-1, Latin Extended-A/B, general punctuation). A label with a character
 * outside them still works: src/components/map/glyphs.ts sends that one range
 * to fonts.openmaptiles.org.
 *
 * Run when a font or a range changes: `npm run data:glyphs`
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = "https://fonts.openmaptiles.org";
const TARGET = join(ROOT, "public", "data", "glyphs");

const { fonts, ranges } = JSON.parse(
  await readFile(join(ROOT, "src", "data", "glyphs.json"), "utf8"),
);

for (const font of fonts) {
  await mkdir(join(TARGET, font), { recursive: true });
  for (const range of ranges) {
    const url = `${SOURCE}/${encodeURIComponent(font)}/${range}.pbf`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    await writeFile(join(TARGET, font, `${range}.pbf`), data);
    console.log(`${font} ${range}: ${Math.round(data.length / 1024)} kB`);
  }
}
