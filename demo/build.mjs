import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Sestaví sdílenou ukázku do jednoho souboru.
 *
 * Vznikají dvě stránky ze stejného zdroje:
 *   demo/atlas.html – samostatná ukázka (vlastní hlavička, vyhledávání, admin)
 *   demo/site.html  – hrubá podoba atlasoftodaysworld.org, kde je místo modrého
 *                     obrázku mapy zasazený živý globus
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
const geo = read("atlas-geo.js");
const data = read("atlas-data.js");
const metrics = read("atlas-metrics.js");
const filled = read("atlas-filled.js");
const texture = read("atlas-texture.js");

/** Vlepí geometrii a obsah místo odkazů na vedlejší skripty. */
function inline(source) {
  const out = source
    .replace('<script src="atlas-geo.js"></script>', `<script>${geo}</script>`)
    .replace('<script src="atlas-data.js"></script>', `<script>${data}</script>`)
    .replace('<script src="atlas-metrics.js"></script>', `<script>${metrics}</script>`)
    .replace('<script src="atlas-filled.js"></script>', `<script>${filled}</script>`)
    .replace('<script src="atlas-texture.js"></script>', `<script>${texture}</script>`);
  if (out.includes('src="atlas-')) {
    throw new Error("ve stránce zůstal odkaz na vedlejší skript – CSP artefaktu ho nenačte");
  }
  return out;
}

/** Kontrola, že se vlepený kód dá aspoň rozparsovat. */
function check(source) {
  const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  for (const code of scripts) new Function(code);
  return scripts.length;
}

function save(name, source) {
  const count = check(source);
  writeFileSync(join(dir, name), source, "utf8");
  process.stdout.write(
    `demo/${name} · ${(source.length / 1024 / 1024).toFixed(2)} MB · ${count} vlepených skriptů v pořádku\n`,
  );
}

// --- samostatná ukázka ---
save("atlas.html", inline(html));

// --- webová stránka s globusem místo obrázku mapy ---
const STAGE_OPEN = '<div id="stage">';
const SCRIPTS_AT = '<script src="https://cdnjs';

const stageStart = html.indexOf(STAGE_OPEN);
const scriptsStart = html.indexOf(SCRIPTS_AT);
if (stageStart < 0 || scriptsStart < 0) throw new Error("index.html má jinou stavbu, než build čeká");

const head = html.slice(0, stageStart);
const stage = html.slice(stageStart, scriptsStart);
const scripts = html.slice(scriptsStart);

const chrome = read("site-chrome.html");
const [above, below] = chrome.split("<!--GLOBE-->");
if (below === undefined) throw new Error("site-chrome.html nemá značku <!--GLOBE-->");

// Globus se chová jako ve vnořené podobě: bez vlastní hlavičky a vyhledávání.
const bootstrap = '<script>document.body.classList.add("embed", "site");</script>\n';

// Vlastní název, ať se stránka nepřekrývá se samostatnou ukázkou.
const site = (head + above + stage + below + bootstrap + scripts).replace(
  "<title>Atlas of Today's World</title>",
  "<title>Atlas Homepage Globe</title>",
);
save("site.html", inline(site));
