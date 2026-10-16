# atlas-maps-data — reference

Long detail for [SKILL.md](SKILL.md). Limits come from the Zod schemas and DB CHECKs; if the code
and this file differ, the code wins — fix this file in the same PR.

## 1. Indicator fields (`indicators`, `src/features/indicators/schema.ts`)

| Field | Rule |
|---|---|
| `id` | slug ≤ 60; it is also the public URL `/view/<id>` — choose it once |
| `label` / `short_label` | ≤ 120 / ≤ 60; the short label is the hover-label name |
| `description` | ≤ 1,000; what is measured, for whom, and caveats (open-ended ends, breaks in series) |
| `unit` | ≤ 20; `$`, `€`, `£` are written before the number, anything else after (`formatValue`) |
| `decimals` | 0–4 |
| `source`, `source_url` | full organisation name + https link to the dataset page |
| `type` | `sequential` (continuous scale) or `categorical` |
| `scale` | `linear` or `log` (log needs `domain_min` > 0) |
| `domain_min`, `domain_max` | required for sequential; must differ |
| `ramp` | 2–9 hex colours, low → high |
| `higher_is_better` | orders the ranking on `/view/<id>` |
| `latest_year` | the year of the newest values; shown in the legend and on About |

Values (`indicator_values`): one per country, `value`, `year` (1800–2100), `note` ≤ 120,
`source_note` ≤ 300 (required for manual values). Categories (`indicator_categories`): integer
`value`, `label` ≤ 80, `color`.

The country card shows up to 6 indicators (`FEATURED_MAX`), chosen per country in the admin.

## 2. Imported indicators (seed)

`supabase/seed.sql` holds the 9 imported layers and their values: Human Development Index, life
expectancy, GDP per capita (PPP, log scale), political regime (categorical), electoral democracy
index, Corruption Perceptions Index, extreme poverty, CO₂ per capita, internet users. The seed
upserts their definitions (label, unit, source, type, scale, domain, ramp, `higher_is_better`,
`latest_year`) and their non-manual values; a description edited in the admin is kept, and
manual values (`is_manual = true`) are never overwritten. Deploys run `supabase db push
--include-seed` (`atlas-testing-release`).

## 3. Checklist: adding a data layer

1. Is the measure a rate, share, index or per-capita value? If not, normalise it first.
2. Find the primary provider and its licence; note dataset name, version or year, and URL.
3. Create the indicator in [Map data layers](https://atlas-of-todays-world.vercel.app/admin/data)
   (custom) — or add it to `supabase/seed.sql` by PR if it is a maintained import.
4. Choose the type and scale; set the domain to cover the real spread; pick a ramp (section 4).
5. Enter values with their year; mark estimates in `note`; leave missing countries empty.
6. Write the description: what, unit, coverage, caveats, open-ended ends.
7. Check the globe legend, `/view/<id>` and the About data-sources list.
8. Check the ramp in greyscale and in a colour-blindness simulator.

## 4. Ramp patterns

| Data | Stops | Pattern |
|---|---|---|
| Sequential (more is more) | 5–7 | one hue, light → dark (seeded HDI, GDP, life expectancy ramps) |
| Diverging (above/below a centre) | 5, 7 or 9 | hue A dark → light grey centre → hue B dark; domain symmetric |
| Categorical | ≤ 7 | distinct hues of similar lightness, no implied order; or an ordered ramp only if the categories are ordered (regime: closed autocracy → liberal democracy) |

Colours for map code that cannot read CSS variables live in `src/config/palette.ts`
(`THEME_COLORS`, `PLAIN_MAP_COLORS`, `GLOBE_COLORS`); each equals its `--color-*` token, enforced
by `palette.test.ts`. Do not hard-code new globe colours elsewhere.

## 5. Visuals (`visuals`, `src/features/visuals/`)

| Field | Limit |
|---|---|
| Title | 200 (required) |
| Caption | 600 |
| Source label | 120; source URL https |
| Embed height | 200–1600 px |
| Embed paste | 20,000 characters (code or link) |
| Custom map spec | 200 kB |

Embed providers (`EMBED_PROVIDER_INFO` in `src/lib/embeds.ts`):

| Provider | Accepted input | Stored canonical URL | Auto height |
|---|---|---|---|
| Datawrapper | iframe, script embed, `datawrapper.de/_/<id>/` link | `https://datawrapper.dwcdn.net/<id>/<version>/` | yes |
| Flourish | iframe, script embed (`data-src`), `public.flourish.studio` link | `https://flo.uri.sh/visualisation/<id>/embed` | yes |
| Our World in Data | grapher URL with its settings | `https://ourworldindata.org/grapher/<chart>?…` | no (600 px) |
| World Bank | share widget or indicator page link | `https://data.worldbank.org/share/widget?…` | no (450 px) |

## 6. Custom map spec v1 (`src/features/visuals/map/types.ts`)

| Part | Limits and options |
|---|---|
| `view` | mode `countries` / `region` / `bounds`; `bounds` [west, south, east, north] (east may exceed 180 across the antimeridian); projection `mercator` / `globe`; basemap `light` / `satellite`; country `labels` on/off |
| `countries` | ≤ 50 highlights: ISO3, fill, opacity 0–1, optional outline |
| `points` | ≤ 500: id `[a-z0-9]{1,16}`, lat ±85, lon ±180, label ≤ 120 (required), `showLabel`, colour, size 6–48 px, icon from `MAP_ICON_NAMES` or none, `pulse`, optional popup |
| `popup` | HTML ≤ 5,000 before sanitizing (`p`, `br`, `strong`, `em`, `a`, `ul`, `ol`, `li`, `span`); font sans / display / serif; size sm / md / lg; text and background colour; max width 160–420 px |
| `legend` | visible, title ≤ 120, corner, ≤ 20 items (label ≤ 80, colour and/or icon) |

The builder keeps an undo history (`builder-state.ts`). The light basemap draws disputed borders in
`PLAIN_MAP_COLORS.disputed`, so custom maps follow the same territory policy as the globe.

## 7. Custom map areas

Areas drawn on the globe (Admin → [Custom map areas](https://atlas-of-todays-world.vercel.app/admin/areas),
`src/features/map/schema.ts`): one GeoJSON polygon ring of 4–2,000 points (a Feature or a
one-feature collection is accepted), name ≤ 120, label ≤ 60, note ≤ 1,000, fill and stroke.
Map appearance: saturation 0.2–2, border width 0.4–2.2.

## 8. More sources

- OSM attribution guidelines (when OSM-derived tiles are used) — https://osmfoundation.org/wiki/Licence/Attribution_Guidelines
- Natural Earth terms of use — https://www.naturalearthdata.com/about/terms-of-use/
- OWID grapher example with "Sources and processing" — https://ourworldindata.org/grapher/life-expectancy
- Datawrapper: responsive annotations — https://www.datawrapper.de/blog/better-more-responsive-annotations-in-datawrapper-data-visualizations
- NPS: web map accessibility — https://www.nps.gov/maps/web/accessibility
