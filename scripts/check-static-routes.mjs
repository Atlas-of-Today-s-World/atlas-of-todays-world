#!/usr/bin/env node
/**
 * Fails when public pages stopped being prerendered. One stray dynamic API —
 * cookies() in a shared layout, a config flag such as experimental.authInterrupts
 * (PR #180) — turns every page into ƒ, and the site is then rendered per request
 * with `Cache-Control: private, no-store` while the build still passes.
 *
 * Usage (CI): npm run build | tee build.log; node scripts/check-static-routes.mjs build.log
 */
import { readFileSync } from "node:fs";
import { dynamicRouteProblems, parseRouteTable } from "./lib/route-table.mjs";

// Public pages served from the cache (static or ISR) — one per kind of page.
const REQUIRED = [
  "/[locale]",
  "/[locale]/about",
  "/[locale]/topics",
  "/[locale]/topics/[slug]",
  "/[locale]/countries",
  "/[locale]/country/[slug]",
  "/[locale]/region/[slug]",
  "/[locale]/global-issue/[slug]",
  "/[locale]/news",
  "/[locale]/news/[slug]",
  "/[locale]/view/[indicator]",
  "/[locale]/skills",
  "/[locale]/skills/[name]",
];

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/check-static-routes.mjs <build output file>");
  process.exit(2);
}

const problems = dynamicRouteProblems(parseRouteTable(readFileSync(file, "utf8")), REQUIRED);
if (problems.length > 0) {
  console.error("Public pages are no longer prerendered:");
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  console.error(
    "Something made them dynamic (a request API in a shared layout, a next.config flag…).",
  );
  process.exit(1);
}
console.log(`✓ ${REQUIRED.length} public routes are prerendered (static/ISR).`);
