/**
 * Reads the "Route (app)" table that `next build` prints and tells how each
 * route renders. A route prerendered through generateStaticParams prints
 * without a marker of its own and lists its paths underneath:
 *
 *   ├   /[locale]/about
 *   │ └ ● /en/about                          1h      1y
 *   ├ ƒ /[locale]/search
 *
 * Used by scripts/check-static-routes.mjs (CI) and tests/unit/route-table.test.ts.
 */

const MARKERS = { "○": "static", "●": "ssg", "◐": "partial", ƒ: "dynamic" };

// After the tree glyph at the table's column: an optional marker, then the route.
const ENTRY = /^[┌├└]\s([○●◐ƒ]|\s)\s(\S+)/;
// A path listed under a route: "│ └ ● /en/about", or "  └ ● …" under the last route.
const CHILD = /^[│\s]\s+[├└]\s[○●◐ƒ]\s/;

const ANSI = /\u001b\[[0-9;]*m/g;

/**
 * @param {string} output the build output (a CI log with timestamps in front works too)
 * @returns {Map<string, { kind: "static" | "ssg" | "partial" | "dynamic" | "prerendered", paths: number }>}
 *   route → how it renders; "prerendered" = no marker of its own, its paths listed below.
 */
export function parseRouteTable(output) {
  const routes = new Map();
  const lines = output.replace(ANSI, "").split(/\r?\n/);
  const start = lines.findIndex((line) => line.includes("Route (app)"));
  if (start === -1) return routes;
  // The tree glyphs start in the column of the heading.
  const column = lines[start].indexOf("Route (app)");
  let current = null;
  for (const line of lines.slice(start + 1)) {
    const cell = line.slice(column);
    const entry = ENTRY.exec(cell);
    if (entry) {
      current = { kind: entry[1].trim() ? MARKERS[entry[1]] : "prerendered", paths: 0 };
      routes.set(entry[2], current);
    } else if (current && CHILD.test(cell)) {
      current.paths += 1;
    } else {
      break; // a blank line or the legend ends the table
    }
  }
  return routes;
}

/**
 * Problems for routes that must be served from the cache (static or ISR).
 * @param {ReturnType<typeof parseRouteTable>} routes
 * @param {string[]} required
 * @returns {string[]}
 */
export function dynamicRouteProblems(routes, required) {
  if (routes.size === 0) return ['No "Route (app)" table in the build output.'];
  const problems = [];
  for (const route of required) {
    const entry = routes.get(route);
    if (!entry) problems.push(`${route}: not in the route table.`);
    else if (entry.kind === "dynamic") problems.push(`${route}: ƒ (dynamic), expected static/ISR.`);
    else if (entry.kind === "prerendered" && entry.paths === 0)
      problems.push(`${route}: no prerendered paths listed.`);
  }
  return problems;
}
