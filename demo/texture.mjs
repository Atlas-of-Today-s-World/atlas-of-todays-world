import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

/**
 * Udělá z družicové textury `demo/atlas-texture.js`.
 *
 * Ukázka nesmí sahat na síť (CSP artefaktu), takže podklad globusu musí být
 * vlepený ve stránce jako data URI. Zdroj je NASA Blue Marble (public domain,
 * 5400×2700) v equirektangulární projekci; stránka si ho přepočítá na kouli.
 *
 * Velikost je kompromis: 4096×2048 je čtyřikrát víc detailu než původní 2048,
 * v stránce zabere ~0,9 MB a v paměti prohlížeče ~33 MB. Větší textura vypadá
 * při velkém přiblížení líp, ale paměť roste kvadraticky.
 *
 * Použití: npm run demo:texture [šířka] [kvalita]
 */
const dir = dirname(fileURLToPath(import.meta.url));
const SOURCE_URL =
  "https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73776/world.topo.bathy.200408.3x5400x2700.jpg";
const source = join(dir, "blue-marble-src.jpg");
const target = join(dir, "blue-marble.jpg");

const width = Number(process.argv[2] ?? 4096);
const quality = Number(process.argv[3] ?? 80);

if (!existsSync(source)) {
  process.stdout.write(`stahuji předlohu…\n`);
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`předloha se nestáhla (${response.status})`);
  writeFileSync(source, Buffer.from(await response.arrayBuffer()));
}

const resized = await sharp(source)
  .resize(width, width / 2, { kernel: "lanczos3" })
  .jpeg({ quality, mozjpeg: true })
  .toBuffer();

writeFileSync(target, resized);

const dataUri = `data:image/jpeg;base64,${resized.toString("base64")}`;
writeFileSync(join(dir, "atlas-texture.js"), `window.ATLAS_TEXTURE=${JSON.stringify(dataUri)};\n`, "utf8");

process.stdout.write(
  `demo/atlas-texture.js · ${width}×${width / 2} q${quality} · ` +
    `${(resized.length / 1024 / 1024).toFixed(2)} MB obrázku → ` +
    `${(dataUri.length / 1024 / 1024).toFixed(2)} MB v stránce\n`,
);
