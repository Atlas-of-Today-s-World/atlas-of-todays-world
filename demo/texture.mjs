import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Udělá z družicové textury `demo/atlas-texture.js`.
 *
 * Ukázka nesmí sahat na síť (CSP artefaktu), takže podklad globusu musí být
 * vlepený ve stránce jako data URI. Zdroj je NASA Blue Marble (public domain,
 * land_shallow_topo 2048×1024) – v equirektangulární projekci, kterou si
 * stránka přepočítá na kouli.
 *
 * Použití: npm run demo:texture
 */
const dir = dirname(fileURLToPath(import.meta.url));
const source = join(dir, "blue-marble.jpg");
const bytes = readFileSync(source);

if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
  throw new Error("blue-marble.jpg není JPEG – stáhl se místo něj chybový výstup?");
}

const dataUri = `data:image/jpeg;base64,${bytes.toString("base64")}`;
writeFileSync(join(dir, "atlas-texture.js"), `window.ATLAS_TEXTURE=${JSON.stringify(dataUri)};\n`, "utf8");

process.stdout.write(
  `demo/atlas-texture.js · ${(bytes.length / 1024).toFixed(0)} kB obrázku → ${(dataUri.length / 1024).toFixed(0)} kB v stránce\n`,
);
