---
name: atlas-performance
title: Performance
description: Speed rules for the Atlas: Core Web Vitals targets and today's baseline, CDN caching and ISR, images and fonts, client JavaScript budget, the MapLibre globe, long tasks and INP, and how to measure and investigate a regression. Use when changing anything a reader downloads or waits for (pages, components, images, maps, dependencies, caching), when adding a client component or library, or when a page feels slow.
roles: [frontend, maps-data, release]
---

# Performance

Readers on a mid-range phone should see text in under 2.5 s and get an answer to every tap
within 200 ms. The globe is the product, but it must never delay the text or block the
main thread. Measure first, then change one thing, then measure again.

## Before you start

- Related skills: `atlas-architecture` (the static/ISR rule and cache tags), `atlas-maps-data`
  (what the globe does), `atlas-frontend` (component patterns), `atlas-seo` (LCP hero as a real
  `<img>`), `atlas-testing-release` (CI and production checks).
- Decisions: ADR-014 (JS budget 550 kB) and ADR-017 (MapLibre from `public/maplibre/<version>/`)
  in `docs/architecture/10-rozhodnuti-adr.md`.
- Budgets, measuring commands and the regression procedure: [reference](reference.md).

## Targets and baseline

Pass/fail is field data (CrUX) at the 75th percentile, mobile and desktop separately. Lab
numbers are diagnostics.

| Metric | Good (p75) | Atlas lab baseline, mobile throttled (2026-10-16) |
|---|---|---|
| LCP | ≤ 2.5 s | 2.25 s `/`, 2.61 s topic, 2.75 s `/country/china`, 2.61 s `/region/east-asia` |
| INP | ≤ 200 ms | not measured in the field; lab TBT 1.1–2.5 s on map pages (main risk) |
| CLS | ≤ 0.1 | 0 on all pages checked |
| TTFB (diagnostic) | ≤ 0.8 s | 0.37–0.57 s (CDN hit, from Prague) |

Numbers to beat: long tasks of 1.1–2.5 s total on map pages (one task of 1.3 s on the country
page: MapLibre init, GeoJSON parse, hydration), about 770 KB of JS transfer on the country and
region pages, `maplibre-gl.mjs` 289 KB, `countries.geo.json` 163 KB transferred (503 KB raw).

## Rules

### Delivery and caching
- Every public page is served from the CDN. The static/ISR rule itself lives in
  `atlas-architecture`; verify it here: `curl -sI <url> | grep -i x-vercel-cache` shows `HIT`,
  `PRERENDER` or `STALE` after a warm-up. A repeated `MISS` means the route turned dynamic or
  uncacheable. Find out why before merging.
- Never send `Set-Cookie`, `Vary: Cookie`, `private` or `no-store` on a public response. Each
  silently disables CDN caching. `Cache-Control: public, max-age=0, must-revalidate` on HTML is
  normal: the browser revalidates, the CDN keeps the page.
- The data cache pattern (`unstable_cache` + `tags.*` + `PUBLIC_REVALIDATE_SECONDS`, React
  `cache()`, `updateTag` on writes, never raising the interval) is defined in
  `atlas-architecture`. Performance adds: keep each cached item under 2 MB (Next skips larger
  ones) and split big payloads under their own tag, as `tags.country(iso3)` and
  `tags.indicator(id)` do.
- Functions run in `fra1` (`vercel.json`), next to Supabase in Frankfurt. Don't add regions or
  move DB-reading code to the edge.
- Static assets keep their headers from `next.config.ts`: `/maplibre/*` immutable for a year,
  `/data/*` one day plus a week of stale-while-revalidate.

### LCP
- The LCP element is in the server HTML. On map pages it is text: the globe starts only after
  the page is idle (`requestIdleCallback`, 1.5 s timeout) and only once its container has a size
  (`AtlasGlobe`). Keep that order; never start MapLibre during hydration.
- An LCP photo is a real `<img>` with `src={photoUrl(src, PHOTO_WIDTH.hero)}`,
  `srcSet={photoSrcSet(...)}`, a `sizes` that matches the layout, `width`/`height`, and
  `fetchPriority="high"` (see `ArticleHero`). Never `loading="lazy"` on it.
- When the LCP photo is a CSS background (the first card of a list), announce it with
  `preload(photoUrl(photo, PHOTO_WIDTH.card), { as: "image", fetchPriority: "high" })` from
  `react-dom`, as `/topics` and `/global-issues` do.
- At most one or two high-priority images per page. Next 16 deprecated `next/image`
  `priority`; use `preload` or `fetchPriority`.
- Fonts: `next/font` Inter and Manrope, `latin` subset, `display: "swap"` (`src/app/layout.tsx`).
  Don't add a font family, a preloaded subset or a CSS `@import` of web fonts.

### Images
- Request only widths from `PHOTO_WIDTH` (`src/lib/images.ts`: 256, 384, 640, 828, 1920) or other
  values in Next's default `deviceSizes`/`imageSizes`; the optimizer refuses other widths.
- Quality is 75 (`photoUrl`). Next 16 accepts only `images.qualities` (default `[75]`); a new
  quality needs a config change and a reason.
- AVIF then WebP come from `images.formats` in `next.config.ts`. Only `PHOTO_ORIGINS` and
  `/images/` are optimized.
- Below-the-fold images use `loading="lazy"` and `decoding="async"`. Every image has `width` and
  `height` or an `aspect-ratio`.

### Layout stability (CLS)
- Reserve space for everything that loads late: images, the globe, charts, embeds (`EmbedFrame`
  sets its height before the iframe exists), banners. Skeletons (`FullPageSkeleton`,
  `RailSkeleton`) match the final size.
- Animate only `transform` and `opacity`. The coin and spark animations stay; keep them on
  those properties.
- Keep pages bfcache-friendly: no `unload` handlers, no `no-store` on HTML.

### Client JavaScript
- Server Components by default; `"use client"` only on the interactive leaf.
- Keep `tests/unit/client-bundle.test.ts` green (no `zod` or `@supabase/ssr` in client code;
  how to comply: `atlas-frontend`).
- MapLibre JS and CSS never enter a shared bundle: the loader rules are in `atlas-maps-data`
  (`loadMapLibre()`, CSS only in `src/app/[locale]/(map)/layout.tsx`).
- Load rarely shown, heavy widgets on demand: `next/dynamic` (`LazyCountryQuiz`, the header's
  `MenuDialog` with the newsletter form) or `lazy()` (`MapVisual` → `MapCanvas`). Admin
  libraries (TipTap editor, `DataTable`) never reach a public page.
- Next prefetches every link in view, including the target route's scripts, and Turbopack
  gives each layout (map, full-width, pages, membership) its own copies of shared code. So
  site-wide chrome (header and footer menus `MenuLink`, the floating Newsletter and Support
  buttons, the cookie notice, "Full page view") uses `<Link prefetchOnIntent>`: prefetch on
  hover, focus or touch. Lighthouse counts prefetched scripts in `resource-summary:script`.
- Before adding a client dependency or a large client component, run `npx next analyze` and
  compare the route's first-load JS. Over about 20 KB compressed needs a reason in the PR.
- Third-party scripts use `next/script` with `strategy="lazyOnload"` unless needed before
  interaction. Iframes go through `EmbedFrame` (mounted near the viewport, `loading="lazy"`).

### MapLibre and geodata
- Loading (runtime import from `/maplibre/<version>/`, lazy metric layers) follows
  `atlas-maps-data`. The budgets below are performance rules.
- Load GeoJSON by URL (`GLOBE_DATA.countries`), never inline it in JS, so the worker parses it
  off the main thread. `countries.geo.json` must not grow beyond today's 163 KB transfer
  (503 KB raw; `npm run data:optimise` simplifies to 2 decimals). Past about 1 MB raw, switch
  to vector tiles.
- Hover and selection use `setFeatureState` (`globe/featureState.ts`), never `setData`. Keep
  layers few, with `minzoom`/`maxzoom`.
- On touch screens (`isTouchScreen()`) the globe does less: `TOUCH_MAP_OPTIONS` (no fades,
  64-tile cache), `touchStyle`, idle spin at about 12 fps (`useIdleSpin`), first spin only after
  the reader's first input on the page. New animations follow the same rule.
- A page that only loads must stop drawing once the globe is shown: every frame of continuous
  animation is main-thread work (Total Blocking Time, Speed Index never settle). In software
  WebGL (SwiftShader in PageSpeed / headless Chrome, llvmpipe, Basic Render Driver;
  `globe/lowPower.ts`) one globe frame costs 300–600 ms, so the globe drops to pixel ratio 1
  and moves only when asked (rotate button). The spin also stops by itself after three steps
  over 250 ms (`slowStepWatch`). Any new animation needs the same guard.

### Long tasks and INP
- Aim for no main-thread task over 50 ms after hydration; anything over 200 ms is a bug.
- In event handlers, update the visible state first, then yield (`await new Promise((r) =>
  setTimeout(r, 0))`, or `scheduler.yield()` where supported) before heavy work. Mark
  non-urgent updates with `startTransition`.
- Map clicks: set the selection, yield, then run feature queries, panel fetches and
  `setFeatureState` loops.
- Don't hydrate what doesn't need to be interactive: long lists and article text stay server
  rendered. Debounce typing (`useDebouncedSearch`).

## How we do it in Atlas

LCP photo as a real image (`src/components/atlas/ArticleHero.tsx`, shortened):

```tsx
<img
  src={photoUrl(hero, PHOTO_WIDTH.hero)}
  srcSet={photoSrcSet(hero, [PHOTO_WIDTH.card, 1200, PHOTO_WIDTH.hero])}
  sizes="100vw"
  alt={alt}
  width={1600}
  height={640}
  fetchPriority="high"
  decoding="async"
/>
```

LCP photo that is a CSS background (`src/app/[locale]/(map)/(full)/topics/page.tsx`):

```ts
const firstPhoto = safeUrl(cards[0]?.hero);
if (firstPhoto)
  preload(photoUrl(firstPhoto, PHOTO_WIDTH.card), { as: "image", fetchPriority: "high" });
```

Checking the CDN: `curl -sI https://atlas-of-todays-world.vercel.app/topics | grep -i x-vercel-cache`.

## Checklist

- [ ] `x-vercel-cache` is `HIT`/`PRERENDER` on the changed public routes (preview deploy).
- [ ] No cookies, headers or `no-store` in a public path; revalidate not raised.
- [ ] LCP element in server HTML; LCP image `fetchPriority="high"`, not lazy.
- [ ] Every image, embed and chart has a reserved size.
- [ ] New client code is a leaf; client-bundle test passes; `npx next analyze` checked for
      new dependencies.
- [ ] Nothing starts MapLibre or heavy work before idle; no task over 200 ms in a trace.
- [ ] Measured before and after (numbers in the PR description).

## Anti-patterns

- Reading `cookies()`/`headers()` in a public layout: every page goes dynamic and misses the CDN.
- Raising `revalidate` "to save requests": breaks scheduled publishing.
- `loading="lazy"` on the hero, or `fetchPriority="high"` on every card.
- Importing `maplibre-gl`, a chart library or the editor into a shared layout.
- Parsing GeoJSON on the main thread, or inlining it into the JS bundle.
- Optimising from one Lighthouse run on a fast laptop: use throttling, several runs, field data.

## Known gaps (2026-10-16)

1. Map pages block the main thread for 1.1–2.5 s (TBT), with a 1.3 s single task on
   `/country/china`. INP is the main risk.
2. About 770 KB JS transfer on country and region pages, about 520 KB on home and topics.
3. Mobile lab LCP is just over 2.5 s on topic, country and region pages, driven by FCP
   (render-blocking CSS/JS and fonts), not by images.
4. No `preconnect` to the tile host (`server.arcgisonline.com`) in the server HTML; `warmUp()`
   adds it only when the globe starts, then about 31 tiles load.
5. No field data: Vercel Analytics is installed, but no Speed Insights or
   `useReportWebVitals`; low-traffic URLs have no CrUX data.
6. Lighthouse CI runs only nightly (`full-tests.yml`) and only with the desktop preset.

## Sources

[Web Vitals](https://web.dev/articles/vitals) · [thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds) ·
[optimize LCP](https://web.dev/articles/optimize-lcp) · [optimize INP](https://web.dev/articles/optimize-inp) ·
[optimize CLS](https://web.dev/articles/optimize-cls) · [Vercel CDN cache](https://vercel.com/docs/caching/cdn-cache) ·
[MapLibre large data](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/). Full list in
[reference](reference.md#sources).
