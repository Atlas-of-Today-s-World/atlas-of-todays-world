// Worker MapLibre 6 jako statický soubor (ADR-013 → A9).
//
// MapLibre 6 hledá worker vedle svého modulu (import.meta.url). Bundler Next
// ale z knihovny udělá chunk s jiným jménem a worker vedle něj nenajde — mapa
// pak nenačte hranice zemí. Proto se worker a sdílený modul, který importuje,
// kopírují do public/maplibre/<verze>/ a globus ho nastaví přes setWorkerUrl.
// Verze v cestě = nový soubor při každém upgradu (dlouhá cache bez rizika).
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "node_modules", "maplibre-gl", "dist");
const { version } = JSON.parse(
  readFileSync(join(root, "node_modules", "maplibre-gl", "package.json"), "utf8"),
);
const target = join(root, "public", "maplibre", version);
mkdirSync(target, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(dist, file), join(target, file));
}
console.log(`maplibre worker ${version} → public/maplibre/${version}/`);
