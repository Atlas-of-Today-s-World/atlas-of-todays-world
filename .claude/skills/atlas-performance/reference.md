# Performance reference

Detail for [atlas-performance](SKILL.md).

## Baseline measurements (2026-10-16)

Playwright + Edge, 412×823 mobile viewport, 4× CPU throttle, about 1.6 Mbps and 150 ms RTT,
one run per page, production site. PageSpeed Insights returned 429 without an API key, so no
CrUX numbers yet.

| Page | FCP | LCP (element) | CLS | TBT | Max long task | Transfer | JS |
|---|---|---|---|---|---|---|---|
| `/` | 2.25 s | 2.25 s (hero `<p>`) | 0 | 1.09 s | 401 ms | 1.0 MB | 524 KB |
| `/topics/types-of-migrants` | 2.24 s | 2.61 s (hero image, AVIF) | 0 | 0.34 s | 331 ms | 0.88 MB | 516 KB |
| `/country/china` | 2.07 s | 2.75 s (`<p>`) | 0 | 2.48 s | 1,288 ms | 1.26 MB | 769 KB |
| `/region/east-asia` | 2.29 s | 2.61 s (`<p>`) | 0 | 1.69 s | 486 ms | 1.25 MB | 767 KB |

TTFB 0.37–0.57 s from Prague (CDN hit). HTML: 115–137 KB uncompressed on map pages, 367 KB on a
topic (RSC payload). Largest assets on `/`: `maplibre-gl.mjs` about 289 KB, `countries.geo.json`
about 163 KB, two woff2 fonts (48 + 24 KB), 31 ArcGIS tiles.

Reading: CLS is excellent. LCP sits at the 2.5 s line and follows FCP (render-blocking CSS, JS
and fonts), not images. INP is the main risk: map pages run long tasks from MapLibre init,
GeoJSON parsing and hydration.

## Budget proposal

For the owner to confirm (ADR-014 already sets 550 kB of JS and LCP < 2.5 s). "Lab" means the
throttled mobile setup above or Lighthouse mobile.

| Metric | Now (lab) | Budget | Enforced today |
|---|---|---|---|
| LCP, every public page | 2.25–2.75 s | ≤ 2.5 s | LHCI desktop, error (warn on `/region/`) |
| CLS | 0 | ≤ 0.05 lab, ≤ 0.1 field | no |
| TBT, map pages | 1.1–2.5 s | ≤ 600 ms, later ≤ 300 ms | no |
| Longest task after load | 331–1,288 ms | ≤ 200 ms | no |
| JS transfer, map pages (incl. MapLibre) | about 770 KB | ≤ 550 KB | LHCI `resource-summary:script:size` 550000, error |
| JS transfer, text pages (topic, news, author) | about 516 KB | ≤ 550 KB now; goal 170 KB excluding MapLibre | same |
| `countries.geo.json` | 163 KB transfer | ≤ 163 KB | no |
| Field p75 (CrUX or RUM) | none | LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 | no |

Note: Lighthouse counts only scripts loaded during its run. MapLibre starts at browser idle, so
a Lighthouse number can look better than a full trace. Check the transfer in a trace too.

Suggested next steps: a mobile Lighthouse preset next to the desktop one in `lighthouserc.json`,
a TBT assertion on map pages, and field data (Vercel Speed Insights, a new dependency the owner
must approve, or `useReportWebVitals` sending to Vercel Analytics).

## Measuring

### Lab, locally
```sh
npm run build && npm run start          # production server on :3000 (reads your .env.local, atlas-dev)
npx --yes @lhci/cli@0.14 autorun         # the nightly Lighthouse config: lighthouserc.json
npx next analyze                         # bundle analyzer (Next 16.1+, Turbopack)
```
`npm run verify` builds into `.next-build` when `next dev` is running.

In Chrome DevTools → Performance: CPU 4× slowdown, network "Slow 4G", record a reload, then
read LCP, long tasks (red corners) and the "Bottom-up" tab. Playwright traces work too
(`trace: "on"` in a local run of `playwright.config.ts`; CI keeps traces off because the repo
is public).

### Production
```sh
curl -sI https://atlas-of-todays-world.vercel.app/country/china | grep -iE "x-vercel-cache|cache-control|x-vercel-id"
```
Expect `x-vercel-cache: HIT` (or `PRERENDER`/`STALE`) and an id starting with `fra1::`.

- PageSpeed Insights (lab + CrUX field):
  [home](https://pagespeed.web.dev/report?url=https%3A%2F%2Fatlas-of-todays-world.vercel.app%2F),
  [country](https://pagespeed.web.dev/report?url=https%3A%2F%2Fatlas-of-todays-world.vercel.app%2Fcountry%2Fchina).
  The API needs a key (`&key=…`), otherwise it answers 429.
- Nightly Lighthouse results: artifact "lighthouse" of
  [Full tests](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/actions/workflows/full-tests.yml).
- Vercel Analytics (page views, referrers; cookie-less): [Vercel team](https://vercel.com/atlas-of-today-s-world)
  → project → Analytics.
- Search Console Core Web Vitals report (field, once traffic is enough):
  [report](https://search.google.com/search-console/core-web-vitals?resource_id=https%3A%2F%2Fatlas-of-todays-world.vercel.app%2F).

## Investigating a regression

1. **Confirm it.** Reproduce on the production URL with the throttled setup, three runs, and
   compare with the baseline table. One slow run is noise.
2. **Check delivery.** `curl -sI` the page: `x-vercel-cache` `MISS` on every request or a region
   other than `fra1` points to caching. Look in the build log route table for a public route
   that is no longer static (the CI step `scripts/check-static-routes.mjs` should have failed;
   check why it didn't). Look for new `cookies()`, `headers()`, `searchParams` or `no-store`.
3. **Find the change.** `git log --oneline -- <files of the route>` since the last good
   deploy. Vercel keeps every deployment, so compare the old and new deployment URLs.
4. **Split the metric.**
   - LCP: which element? TTFB, resource delay, load or render delay (DevTools LCP breakdown)?
     A lazy or late-discovered hero, a new font, or blocking CSS/JS.
   - INP/TBT: record a trace, sort long tasks, read "Bottom-up". Typical causes: a client
     component that hydrates a big tree, a library added to a shared layout, MapLibre starting
     before idle, synchronous work in a click handler.
   - CLS: DevTools "Layout shifts" track; find the element without a reserved size.
   - JS size: `npx next analyze` on both commits; diff the route's first-load JS.
5. **Fix one thing at a time** and measure again. Put the before and after numbers in the PR.
6. **Prevent it.** Add or tighten a guard: an LHCI assertion, a unit test like
   `client-bundle.test.ts`, or a rule in this skill.

## Where things live

| Concern | File |
|---|---|
| Cache tags, `PUBLIC_REVALIDATE_SECONDS` | `src/lib/cache/tags.ts` |
| Region | `vercel.json` (`fra1`) |
| Static asset headers, image formats, cache TTL | `next.config.ts` |
| Photo widths, `photoUrl`, `photoSrcSet` | `src/lib/images.ts` |
| Fonts | `src/app/layout.tsx` (`next/font/google`) |
| MapLibre loader, `warmUp()` | `src/components/map/maplibre.ts` |
| Globe start on idle | `src/components/map/AtlasGlobe.tsx` |
| Touch-screen globe options | `src/components/map/globe/touch.ts`, `useIdleSpin.ts` |
| Geodata build | `scripts/fetch-geodata.mjs`, `scripts/optimise-geodata.mjs` |
| Lazy metric layers | `src/app/api/globe-layer/[id]/route.ts` |
| Client bundle guard | `tests/unit/client-bundle.test.ts` |
| Static route guard | `scripts/check-static-routes.mjs` |
| Lighthouse CI | `lighthouserc.json`, job "Lighthouse" in `.github/workflows/full-tests.yml` |

## Sources

- Web Vitals: https://web.dev/articles/vitals
- Thresholds: https://web.dev/articles/defining-core-web-vitals-thresholds
- TTFB: https://web.dev/articles/ttfb · FCP: https://web.dev/articles/fcp
- Optimize LCP: https://web.dev/articles/optimize-lcp
- Optimize INP: https://web.dev/articles/optimize-inp
- Long tasks in DevTools: https://web.dev/articles/long-tasks-devtools
- Optimize CLS: https://web.dev/articles/optimize-cls
- bfcache: https://web.dev/articles/bfcache
- Preconnect: https://web.dev/articles/preconnect-and-dns-prefetch
- Performance budgets: https://web.dev/articles/performance-budgets-101
- Image formats: https://web.dev/articles/choose-the-right-image-format
- Iframe lazy loading: https://web.dev/articles/iframe-lazy-loading
- Third-party facades: https://developer.chrome.com/docs/lighthouse/performance/third-party-facades
- Vercel CDN cache: https://vercel.com/docs/caching/cdn-cache
- Vercel function regions: https://vercel.com/docs/functions/configuring-functions/region
- MapLibre large data: https://maplibre.org/maplibre-gl-js/docs/guides/large-data/
- Next.js 16.4 local docs (`node_modules/next/dist/docs/01-app/`): `03-api-reference/02-components/image.md`,
  `03-api-reference/02-components/font.md`, `02-guides/lazy-loading.md`, `02-guides/scripts.md`,
  `02-guides/package-bundling.md`, `02-guides/production-checklist.md`,
  `01-getting-started/08-caching.md`, `03-api-reference/04-functions/use-report-web-vitals.md`
