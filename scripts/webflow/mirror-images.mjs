#!/usr/bin/env node
/**
 * Moves the photos of the topics imported from the old site off its Webflow
 * CDN: each one is downloaded once, scaled down to at most 1920 px wide, saved
 * as WebP in public/images/webflow/ (served by Vercel, versioned in git) and
 * listed in scripts/webflow/data/image-mirror.json (old URL → new path).
 *
 *   node scripts/webflow/mirror-images.mjs
 *
 * Input: scripts/webflow/data/image-sources.json (the Webflow image URLs the
 * site uses, collected from the public pages and the import data). Repeatable:
 * a file that already exists is not downloaded again. The database is switched
 * to the new addresses by a migration generated from the mirror list.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sources = JSON.parse(
  readFileSync(join(root, "scripts/webflow/data/image-sources.json"), "utf8"),
);
const PUBLIC_DIR = "images/webflow";
const target = join(root, "public", PUBLIC_DIR);
mkdirSync(target, { recursive: true });

/** Wide enough for the full-bleed topic hero; the optimizer serves smaller sizes. */
const MAX_WIDTH = 1920;
const QUALITY = 78;

/** Stable file name from the source URL (decoded, so %20 and a space agree). */
const fileName = (url) =>
  `${createHash("sha1").update(decodeURI(url)).digest("hex").slice(0, 20)}.webp`;

const mirror = {};
let bytesBefore = 0;
let bytesAfter = 0;
const failed = [];

for (const url of sources) {
  const name = fileName(url);
  const path = join(target, name);
  mirror[url] = `/${PUBLIC_DIR}/${name}`;
  if (existsSync(path)) continue;
  const response = await fetch(url);
  if (!response.ok) {
    failed.push(`${response.status} ${url}`);
    delete mirror[url];
    continue;
  }
  const input = Buffer.from(await response.arrayBuffer());
  const output = await sharp(input)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();
  writeFileSync(path, output);
  bytesBefore += input.length;
  bytesAfter += output.length;
  console.log(
    `${(input.length / 1024).toFixed(0).padStart(6)} kB → ${(output.length / 1024).toFixed(0).padStart(4)} kB  ${name}`,
  );
}

writeFileSync(
  join(root, "scripts/webflow/data/image-mirror.json"),
  `${JSON.stringify(mirror, null, 2)}\n`,
);
console.log(
  `\n${Object.keys(mirror).length} photos mirrored; new downloads ${(bytesBefore / 1e6).toFixed(1)} MB → ${(bytesAfter / 1e6).toFixed(1)} MB.`,
);
if (failed.length) {
  console.log(`Not available:\n  ${failed.join("\n  ")}`);
  process.exitCode = 1;
}
