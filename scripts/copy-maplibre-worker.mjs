// MapLibre 6 worker as a static file (ADR-013 → A9).
//
// MapLibre 6 looks for its worker next to its module (import.meta.url). The Next
// bundler, however, turns the library into a differently named chunk and the worker
// is not found next to it — the map then fails to load country borders. So the
// worker and the shared module it imports are copied to public/maplibre/<version>/
// and the globe sets it via setWorkerUrl. Version in the path = a new file on every
// upgrade (long caching without risk).
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
// The main module is loaded from here too (src/components/map/maplibre.ts), so
// the main thread and the worker share a single maplibre-gl-shared.mjs.
// Their source maps too: the modules point at them, and without them browsers'
// dev tools (and Lighthouse's "valid source maps" check) report a 404.
for (const file of ["maplibre-gl.mjs", "maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(dist, file), join(target, file));
  copyFileSync(join(dist, `${file}.map`), join(target, `${file}.map`));
}
console.log(`maplibre worker ${version} → public/maplibre/${version}/`);
