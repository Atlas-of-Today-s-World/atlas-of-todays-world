import { describe, expect, it } from "vitest";
import { dynamicRouteProblems, parseRouteTable } from "../../scripts/lib/route-table.mjs";

// Shapes copied from `next build` output in CI (before and after PR #180).
const STATIC = `
   Finalizing page optimization ...

Route (app)                                               Revalidate  Expire
┌ ○ /_not-found                                                   1h      1y
├   /[locale]/about
│ └ ● /en/about                                                   1h      1y
├   /[locale]/country/[slug]
│ ├ ● /en/country/china                                           1h      1y
│ └ ● [+225 more paths]
├ ƒ /[locale]/search
└   /sitemaps/[id].xml
  ├ ● /sitemaps/pages.xml                                         1h      1y
  └ ● [+5 more paths]


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
`;

const DYNAMIC = `
Build, smoke a e2e\tRun npm run build\t2026-10-15T08:38:05.6440027Z Route (app)                                               Revalidate  Expire
Build, smoke a e2e\tRun npm run build\t2026-10-15T08:38:05.6488487Z ├ ƒ /[locale]/about
Build, smoke a e2e\tRun npm run build\t2026-10-15T08:38:05.6698354Z ├ ƒ /[locale]/country/[slug]
Build, smoke a e2e\tRun npm run build\t2026-10-15T08:38:05.6699455Z ├   /[locale]/feed.xml
Build, smoke a e2e\tRun npm run build\t2026-10-15T08:38:05.6700869Z │ └ ● /en/feed.xml                                                1h      1y
Build, smoke a e2e\tRun npm run build\t2026-10-15T08:38:05.6821229Z ○  (Static)   prerendered as static content
`;

const REQUIRED = ["/[locale]/about", "/[locale]/country/[slug]"];

describe("build route table", () => {
  it("reads markers and the prerendered paths under a route", () => {
    const routes = parseRouteTable(STATIC);
    expect(routes.get("/_not-found")).toEqual({ kind: "static", paths: 0 });
    expect(routes.get("/[locale]/about")).toEqual({ kind: "prerendered", paths: 1 });
    expect(routes.get("/[locale]/country/[slug]")).toEqual({ kind: "prerendered", paths: 2 });
    expect(routes.get("/[locale]/search")).toEqual({ kind: "dynamic", paths: 0 });
    expect(routes.get("/sitemaps/[id].xml")).toEqual({ kind: "prerendered", paths: 2 });
    expect(routes.size).toBe(5);
    expect(dynamicRouteProblems(routes, REQUIRED)).toEqual([]);
  });

  it("flags public routes that turned dynamic (CI log with timestamps)", () => {
    const routes = parseRouteTable(DYNAMIC);
    expect(routes.get("/[locale]/feed.xml")).toEqual({ kind: "prerendered", paths: 1 });
    expect(dynamicRouteProblems(routes, REQUIRED)).toEqual([
      "/[locale]/about: ƒ (dynamic), expected static/ISR.",
      "/[locale]/country/[slug]: ƒ (dynamic), expected static/ISR.",
    ]);
  });

  it("fails without a route table or with a missing route", () => {
    expect(dynamicRouteProblems(parseRouteTable("Compiled successfully"), REQUIRED)).toHaveLength(
      1,
    );
    expect(dynamicRouteProblems(parseRouteTable(STATIC), ["/[locale]/entries"])).toEqual([
      "/[locale]/entries: not in the route table.",
    ]);
  });
});
