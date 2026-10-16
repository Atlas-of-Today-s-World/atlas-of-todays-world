---
name: atlas-maps-data
title: Maps, data layers and charts
description: The Atlas globe (MapLibre), its layers, topic badges and status marks, the indicator data layers and their sources, choropleth and colour rules, and the "Maps & charts" visuals (embeds and custom maps). Use when adding or changing a data layer or indicator, colouring the map, touching the globe code, embedding a Datawrapper/Flourish/OWID/World Bank chart, building a custom map, or citing data.
roles: [maps-data, editor, frontend]
---

# Maps, data layers and charts

The globe is the Atlas's front door, and every colour on it is a claim. **Map only comparable
(normalised) values, show where they come from and when, and give every map and chart a text
equivalent.**

## Before you start

- Code changes: `atlas-architecture`, `atlas-frontend`; page weight and loading: `atlas-performance`.
- General WCAG rules (focus, contrast, motion): `atlas-accessibility`. Palette tokens: `atlas-visual-design`.
- New embed provider or anything touching CSP: `atlas-security`.
- Writing captions and citing sources in prose: `atlas-content`.
- Full limits, the indicator checklist and the source list: [reference](reference.md).
- Admin: [Map data layers](https://atlas-of-todays-world.vercel.app/admin/data),
  [Custom map areas](https://atlas-of-todays-world.vercel.app/admin/areas),
  [Map appearance](https://atlas-of-todays-world.vercel.app/admin/appearance),
  [Regions & countries](https://atlas-of-todays-world.vercel.app/admin/regions).

## How the globe works

- `src/components/map/AtlasGlobe.tsx` draws it; props are built on the server in
  `src/app/[locale]/(map)/layout.tsx`. Style and layer ids: `src/components/map/mapStyle.ts`
  (`buildStyle`, `LAYERS`, `TOPIC_LAYERS`, `ZERO_GLOW_LAYERS`, `GLOBE_DATA`).
- **Modes** (`ModeSwitch`): countries, regions, global issues. Region and issue colours are set
  per region / issue in the admin (`fill`, `stroke`); global look (saturation, border width) in
  Map appearance.
- **Topic badges**: the number of topics per place. Computed on the server
  (`src/features/topics/map-counts.ts`: `countTopics`, `badgeNumbers`) from `entries.map_layers`;
  the globe only draws them (`globe/topicBadges.ts`). Never count on the client.
- **Red pulsing zero**: a place with no topic gets a red pill (`GLOBE_COLORS.empty`) and a pulsing
  glow (`globe/zeroPulse.ts`, `useZeroPulse`) — an invitation to write. It pauses in hidden tabs and
  stays still with reduced motion. Keep both behaviours.
- **Status marks** on regions and issues come from `content_status` (none / preparing / ready,
  `src/features/geography/content-status.ts`, drawn by `components/map/global-issues.ts`). Colours:
  `THEME_COLORS.statusReady`, `statusPreparing` in `src/config/palette.ts`.
- **Borders** are Natural Earth 50 m, rebuilt with `npm run data:geo` then `npm run data:optimise`
  into `public/data/`. The Atlas follows **UN practice**: `src/data/territories.json` transfers,
  merges or flags territories (Crimea → Ukraine, Golan → Syria, Northern Cyprus and Somaliland
  merged), each with a note and its UN basis. Flagged territories get the dashed
  `country-disputed` outline. Change the policy only in that file, with the basis cited.
- **Basemap**: MapTiler satellite when `NEXT_PUBLIC_MAPTILER_KEY` is set, otherwise Esri World
  Imagery (`satelliteSource()`); each source declares its `attribution`.

## Rules

### Data layers (indicators)

- One indicator = one row in `indicators` plus values in `indicator_values` (one per country,
  with its year). Edit in Map data layers; schema `src/features/indicators/schema.ts`.
- Map **rates, shares, indices or per-capita values** only. Never colour countries by a raw
  count (refugees, GDP, deaths) — divide by population or area first, or use point symbols in
  a custom map.
- Every indicator states `source` and `source_url`, `unit`, `decimals` and the data year
  (`latest_year`). The legend caption is built from them (`legendFor`: "Label – year · Source: X").
- A manually entered value needs a `source_note` (the database refuses it otherwise); use `note`
  (≤ 120) for "estimate", "excl. Crimea" and similar caveats.
- Missing data stays missing: never enter 0 for "no data". Countries without a value keep the
  neutral land colour (`GLOBE_COLORS.land`) and the hover label says "no data".
- Set `higher_is_better` correctly: it orders the ranking on `/view/<id>`.
- The 9 imported indicators live in `supabase/seed.sql`, which upserts their label, unit, source,
  range and colours on the next seed run. Change those fields in the seed by PR, not only in the
  admin. Manual values (`is_manual`) and edited descriptions survive. Custom indicators are admin-only.

### Choropleth colour and scale

- **Sequential** data (low → high): one hue, light → dark, 5–7 ramp stops (the schema takes 2–9).
  Use a ColorBrewer-style ramp; the seeded layers show the pattern.
- **Diverging** data (meaningful centre such as 0 or the world average): an odd number of stops
  with a light-grey (not white) middle, and a domain symmetric around the centre.
- **Categorical** data: ≤ 7 categories, hues that imply no order, and a label for each
  (`indicator_categories`). Use it for classifications such as political regime.
- The scale is continuous: `colorForValue` interpolates between ramp stops across
  `domain_min`…`domain_max`; values outside the domain clamp to the end colours. Pick a domain
  that covers the real spread and say in the description when the ends are open ("90,000 or more").
- Use the **log** scale for heavily skewed data (income, emissions); it must start above 0.
- Check every ramp in greyscale and with a colour-blindness simulator; vary lightness, not just hue.
  Blue with orange is the safe pair. Never use a rainbow ramp.
- Keep a place's colour the same across the site: region colours belong to regions; do not reuse
  them for data.
- The globe exaggerates high latitudes. When area matters to the message, pair the map with the
  ranking (`/view/<id>`) or a bar chart.

### "Maps & charts" visuals

- One table `visuals` (ADR-027) for four owners: region, global issue, topic, subtopic
  (`VISUAL_OWNERS`). Kinds: `embed`, `image`, `map` (`src/features/visuals/constants.ts`).
  Public: `components/visuals/VisualsCarousel`; admin: `components/admin/VisualsEditor`.
- Every visual has a **title** (≤ 200) that states the takeaway, not the topic ("Half of Sudan's
  displaced fled within the country", not "Displacement"). The title is the iframe title, the
  image's alt text and the caption heading.
- Fill **source label and link** (≤ 120) on every visual, and a caption (≤ 600) with units, the
  data year and any caveat.
- **Embeds** come only from the allowlist in `src/lib/embeds.ts`: Datawrapper, Flourish, Our
  World in Data grapher, World Bank data widget. Editors paste the embed code or link; only the
  canonical URL is stored and the site renders its own sandboxed iframe. Height 200–1600 px.
  Adding a provider means `lib/embeds.ts` + a migration for the DB CHECK (CSP follows
  `EMBED_ORIGINS`) — see `atlas-security`.
- Prefer an embed from the original data publisher (OWID, World Bank) over a screenshot; a
  screenshot is an `image` and loses the data table.

### Custom maps (`map_spec` v1)

- Built in the admin map builder (`src/features/visuals/map/`); the spec type is `MapSpec` in
  `map/types.ts`, validated by `parseMapSpec` (`map/schema.ts`, strict: unknown keys fail).
- Limits (`MAP_LIMITS`): 500 points, 50 highlighted countries, 20 legend items, 200 kB, latitude
  ±85°. Projection `mercator` or `globe`; basemap `light` or `satellite`.
- Every point has a **label**: it is the point's accessible name and the popup heading. Write it
  as a place or event name, not "Point 1".
- Popups accept simple rich text only (paragraphs, bold, italic, links, lists), max 5,000
  characters, sanitized by `sanitizePopupHtml`.
- Show a legend whenever colour or icons carry meaning; one item per colour or icon used.
- Pulsing points: one or two at most, for the place the story is about. They never pulse with
  reduced motion.
- A breaking change to the spec shape means `version: 2` plus a reader for v1 (expand-only, as
  in `atlas-backend`); never reinterpret stored v1 specs.

### Chart choice and accessibility

- Choose the chart by the relationship: change over time → line; ranking → sorted bars;
  part-to-whole → stacked bar (≤ 5 parts); distribution → histogram; location → map.
  Bars start at zero. No pie charts for comparisons; no 3D.
- Use ≤ 7 colours; grey for context, one saturated colour for the point of the chart. Label lines
  and series directly instead of relying on a legend.
- Never let colour alone carry meaning: add labels, values, patterns or a table. Marks need 3:1
  contrast against neighbours; chart text ≥ 12 px.
- Give every map and chart a text equivalent: the title as its takeaway, a caption that states the
  key finding, and a way to the numbers (the embed's data tab, the `/view/<id>` ranking, or a table
  in the text). The globe is never the only path: `/countries`, `/topics` and `/view/<id>` list the same places.
- Note correlation versus causation in the caption when a chart invites the leap.

### Data citation

- Cite the original provider and the Atlas's processing separately: "Source: UNHCR (2025),
  per-capita rate computed by the Atlas."
- Third-party data keeps its licence; check it before republishing values. OWID data is CC BY:
  credit OWID and its underlying source.
- The About page lists data sources live (`{{data-sources}}`), so a new indicator's `source`
  appears there automatically — write it as the organisation's full name.

## Performance notes

- MapLibre is loaded at runtime from `public/maplibre/<version>/` (ADR-017): `loadMapLibre()` in
  `src/components/map/maplibre.ts` sets the worker URL; `scripts/copy-maplibre-worker.mjs` copies the
  files on `predev`/`prebuild`. Never import `maplibre-gl` as a runtime module in a component.
- Metric layers load only when switched on, from `/api/globe-layer/[id]` (`globeLayer()`), as
  ISO3 → colour plus formatted values. Do not ship values in the map layout.
- Custom maps render only near the viewport (`MapVisual`, IntersectionObserver); without WebGL
  they fall back to a list of the points.
- Keep `/data/*.geo.json` small: re-run `data:optimise` after `data:geo`. Budgets: `atlas-performance`.

## Checklist (PR or admin change)

- [ ] Mapped values are normalised; unit, decimals, year and source filled.
- [ ] Ramp: sequential light → dark or diverging with grey centre; ≤ 7 categories; greyscale-checked.
- [ ] Missing data shown as no data, never 0; manual values carry `source_note`.
- [ ] Imported indicator fields changed in `supabase/seed.sql`, not only in the admin.
- [ ] Visual has a takeaway title, caption with year and units, source label and link.
- [ ] Custom map points labelled; legend present when colour or icons carry meaning.
- [ ] Text equivalent exists (caption + data or list page).
- [ ] Border or territory change goes through `src/data/territories.json` with the UN basis.
- [ ] No new direct `maplibre-gl` import or eager layer data in the map layout.

## Anti-patterns

- Colouring countries by total population or total refugees — big countries win by size, not by rate.
- Rainbow or red–green ramps — unreadable for colour-blind readers and imply false order.
- Pasting an embed from an unlisted host (refused) or a raw `<iframe>` into rich text (stripped on save) — use a "Maps & charts" visual.
- Editing an imported indicator's colours only in the admin — the next seed run reverts them.
- A chart titled with a topic instead of a finding — the reader cannot tell what to see.
- Drawing borders differently on a custom map to "simplify" — the territory policy is editorial.

## Sources

- Datawrapper Academy: choropleth maps — https://www.datawrapper.de/academy/what-to-consider-when-creating-choropleth-maps
- Datawrapper Academy: choosing colours — https://www.datawrapper.de/academy/what-to-consider-when-choosing-colors-for-data-visualization
- Axis Maps: choropleth guide — https://www.axismaps.com/guide/choropleth
- ColorBrewer schemes — https://colorbrewer2.org/learnmore/schemes_full.html
- FT Visual Vocabulary — https://github.com/Financial-Times/chart-doctor/blob/main/visual-vocabulary/README.md
- Chartability (POUR-CAF) — https://chartability.github.io/POUR-CAF/
- W3C: complex images — https://www.w3.org/WAI/tutorials/images/complex/
- WCAG 2.2: use of colour — https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
- WCAG 2.2: non-text contrast — https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- Natural Earth: disputed boundaries policy — https://www.naturalearthdata.com/about/disputed-boundaries-policy/
- MapLibre AttributionControl — https://maplibre.org/maplibre-gl-js/docs/API/classes/AttributionControl/
- Our World in Data: FAQs on reuse and citation — https://ourworldindata.org/faqs
- More: [reference](reference.md)
