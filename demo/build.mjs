import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Sestaví sdílenou ukázku do jednoho souboru `demo/atlas.html`.
 *
 * Artefakt na claude.ai běží pod CSP, která nepustí vedlejší skripty ani
 * načítání dat, takže geometrie i obsah musí být vlepené přímo ve stránce.
 * Data se berou z běžící aplikace: `npm run demo:data` (potřebuje `npm run dev`).
 *
 * Použití: npm run demo:build
 */
const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, name), "utf8");

const html = read("index.html");
const out = html
  .replace('<script src="atlas-geo.js"></script>', `<script>${read("atlas-geo.js")}</script>`)
  .replace('<script src="atlas-data.js"></script>', `<script>${read("atlas-data.js")}</script>`);

if (out.includes('src="atlas-')) {
  throw new Error("ve stránce zůstal odkaz na vedlejší skript – CSP artefaktu ho nenačte");
}

// Kontrola, že se vlepený kód dá aspoň rozparsovat.
const scripts = [...out.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
for (const code of scripts) new Function(code);

writeFileSync(join(dir, "atlas.html"), out, "utf8");
console.log(
  `demo/atlas.html · ${(out.length / 1024 / 1024).toFixed(2)} MB · ${scripts.length} vlepených skriptů v pořádku`,
);
