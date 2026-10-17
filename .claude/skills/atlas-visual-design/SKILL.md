---
name: atlas-visual-design
title: Visual design
description: The look of Atlas of Today's World - design tokens in globals.css @theme and src/config/layout.ts, colour roles (dark map layer, light content layer, semantic and red "empty" colours), typography scale, photos and credits, lucide icons, radius, shadow and spacing, and visual variants instead of copies. Use when choosing a colour, font size, icon, image, border, shadow or spacing, adding a token, or styling any new component or page.
roles: [designer, frontend]
---

# Visual design

Atlas has two layers: the **dark map layer** (night-sky globe, glass controls, dark bands) and
the **light content layer** (white panels, paper pages, admin). Everything is built from the
tokens below. A new look is a new token or a new variant, never a hand-picked value.

## Before you start

- Tokens: `src/app/globals.css` (`@theme` and `:root`). Layout numbers: `src/config/layout.ts`.
  Colours for code that cannot read CSS (MapLibre, canvas, OG images, manifest):
  `src/config/palette.ts`.
- See every shared component and its variants in Storybook: `npm run storybook` (port 6006).
- Related skills: `atlas-accessibility` (contrast bar, alt text, motion), `atlas-maps-data`
  (map and chart colour scales), `atlas-frontend` (how to implement a variant), `atlas-ux`
  (which block goes where), `atlas-content` (image licences and credits).

## Rules

### Tokens

- Colours come only from `--color-*` tokens. Never write a hex value, `rgb()` or a Tailwind
  palette colour (`bg-red-600`) in a component.
- In new code use the generated utilities: `bg-paper`, `text-ink-soft`, `border-line`,
  `rounded-panel`, `z-header`. The older `text-[var(--color-ink-soft)]` form means the same and
  is known debt; convert it when you touch the line, not in unrelated PRs.
- Layer order only through the z-index scale: `z-panel` 20, `z-controls` 30, `z-header` and
  `z-dropdown` 40, `z-full-page` 45, `z-mini-globe` 46, `z-floating` 47, `z-overlay` 50,
  `z-notice` 60, `z-skip-link` 100. Plain numbers (`z-10`, `-z-10`) only inside one component.
- Panel widths, the mini globe, the 768 px breakpoint and the 44 px touch size come from
  `layout.ts` (`RAIL`, `RAIL_WIDE`, `MINI_GLOBE`, `DESKTOP_MIN_PX`, `TOUCH_MIN_PX`) and their CSS
  twins (`--rail-width`, `--touch-min`…). `layout.test.ts` keeps both in sync.
- A colour JavaScript needs goes into `palette.ts` as well; `palette.test.ts` checks it equals
  the CSS token.
- Adding a token: put it in `@theme` with a one-line comment saying where it is used. Reuse an
  existing token if the meaning is the same.

### Colour roles

| Role | Tokens | Use |
|---|---|---|
| Map layer | `space`, `space-deep` (page body), `space-raised(-hover)`, `band` | Globe background, glass, dark bands (regional profile header, dark sections) |
| Content layer | white, `paper`, `paper-soft`, `surface-muted`, `surface-hover` | Panels, full pages, cards, admin tables |
| Text | `ink` (headings), `ink-soft` (body), `ink-muted` (secondary), `ink-deep` (on white pills over dark) | All text on light surfaces |
| Lines | `line` (dividers), `field-border` (form control borders) | Separators, card borders, inputs |
| Accent | `accent`, `accent-strong` (hover), `accent-soft` (tints), `accent-bright` (on dark), `link` | One primary action per view, links, focus rings |
| Patrons | `patron`, `patron-strong`, `patron-bright` | Membership and support only |
| Gold | `gold`, `gold-light`, `gold-deep`, `gold-edge` | Coin, spark ring and other warm "support / invite" highlights |
| Status | `success`, `warning`, `danger` (+ `-soft`) | Badges, results, errors |
| Empty | `empty`, `empty-strong`, `empty-soft` | Only "this place has no topics yet" (red zero, `NoTopicsCta`, `ContentStatusBadge`) |
| Content progress | `status-ready(-text)`, `status-preparing(-text)` | Ready / completed (green check), in preparation (amber hourglass), planned region (amber calendar); the `-text` tones fill the region and country pills on the globe |

- Red has two meanings and they never mix: `danger` = something went wrong or is destructive;
  `empty` = an invitation to write the first topic.
- Keep the accent rare so the primary action stands out. Hover, active and focus states are
  stronger than the resting state.
- Dark variants come through props (`tone="dark"`, Note `tone="inverse"`, `kickerVariants`
  `glass`, `glassVariants`), not through new components.
- Contrast facts for the common pairs are in [reference](reference.md#contrast-of-token-pairs).
  Short version: `ink-muted` is the lightest text allowed on white or paper; `line` is decorative
  only; `field-border` is the minimum for a control's outline; `status-preparing` and
  `status-ready` are for icons next to a text label, their `-text` twins are for text.

### Typography

- Two families only: Manrope (`font-display`) for titles and headings, Inter (`font-sans`) for
  everything else. Both load through `next/font` in `src/app/layout.tsx`.
- Rich text always renders inside `.prose-atlas` (15 px, line height 1.75, h2 22 px, h3 17 px,
  underlined links in `link`); `.prose-compact` (13 px) at card size. Do not style rich text ad hoc.
- Use the existing steps, add none: 12, 12.5, 13, 13.5, 14 px for UI text; 15 px prose;
  17 to 18 px small headings and dialog titles; 22 to 26 px section headings (admin h1 is 24 px);
  26 to 34 px page titles; 34 px (52 px from `sm`) for the hero title in `ArticleHero`. 10.5 to 11 px only for uppercase kickers and
  photo credits.
- Short lines under a heading use `Note` (`EmptyNote`, `Lead`: size `xs|sm|md`, tone
  `soft|muted|inverse`). Small uppercase labels use `kickerVariants` (letter spacing 0.1 to
  0.12 em, one line).
- Numbers compared in a column (tables, stats, rankings) get `tabular-nums`.
- Use real typographic characters: … – — “ ” and a non-breaking space between a number and its
  unit.

### Imagery

- Photos come only from trusted origins (`PHOTO_ORIGINS`, `isTrustedPhoto` in `src/lib/images.ts`)
  through `photoUrl` / `photoSrcSet` at the matching `PHOTO_WIDTH` role: avatar, thumb, tile,
  card, hero. Sizes, formats and lazy loading: `atlas-performance`.
- The hero photo is a real `<img>` in `ArticleHero`. Its alt text is the page title: owner
  decision, keep it.
- Every photo shows its credit with `PhotoCredit` (`onPhoto` when it sits on the image). What the
  credit says and which licences are allowed: `atlas-content`.
- Without a photo, a header uses the place's own colour: `heroWash` / `heroStyle` (plain `#rrggbb`
  only).
- Text over a photo always has a dark gradient under it and uses the dark tones.
- Visual cards show the real map or chart, not stock art.
- Alt text: technical rules in `atlas-accessibility`, wording in `atlas-content`.

### Icons

- `lucide-react` only, 16 to 20 px (`size-4`, `size-5`, `size={18}`). No emoji, no icon fonts,
  no hand-drawn SVG when lucide has the glyph.
- An admin section has one icon, defined in `ADMIN_NAV`; pages read it with `navIcon(href)` so
  menu and header match.
- Topic tile icons come from `TILE_ICONS` (`TileIcon`); custom map icons from
  `features/visuals/map/icon-names.ts`.

### Shape, depth and spacing

- Radius: `rounded-full` for buttons, pills, chips and badges; `rounded-lg` for fields and small
  boxes; `rounded-xl` / `rounded-2xl` for cards, form sections and dialogs; `rounded-panel` (18 px)
  for glass panels over the map. A child's radius is never larger than its parent's.
- Shadows only on things that float (glass panels `shadow-2xl shadow-black/40`, popovers,
  floating buttons). Cards on a page use a `border-line` border instead.
- Spacing is Tailwind's default 4 px scale. Full-page column: `ARTICLE_BODY` (`max-w-6xl`).
  Panel sections pad `px-6 sm:px-10`; pull them to the column edge with `PANEL_SECTION_BLEED`.
- Over the map, translucent surfaces are `.glass` / `glassVariants` (`panel`, `pill`), never a
  custom semi-transparent box.

### Motion

- Which properties may animate (transform, opacity): `atlas-performance`. Never `transition-all`.
- Motion explains cause and effect: the globe flies to a place (`GLOBE.flightMs`), a full page
  rises over it (`full-page-in`).
- Keep the owner's animations: `coin-spin`, `coin-shine`, `spark-orbit`, `star-twinkle`,
  `topic-pulse`. Reduced-motion handling: `atlas-accessibility`.

### Charts and maps (basics)

- Colour scales, category limits, legends and chart choice live in `atlas-maps-data`. In code,
  globe colours come from `GLOBE_COLORS` and the plain light map of custom maps from
  `PLAIN_MAP_COLORS` (`src/config/palette.ts`), never from new literals.
- A place, region or global issue keeps the same colour wherever it appears (globe, cards,
  headers via `heroWash`).

## How we do it in Atlas

```tsx
// A new look is a variant of the closest component, not a copy.
<Button variant="patron">Become a patron</Button>
<Badge tone="warning">Scheduled</Badge>
<p className={kickerVariants({ tone: "glass" })}>Latest subtopics</p>
<EmptyNote size="sm" tone="muted">No topics match these filters.</EmptyNote>
<div className={glassVariants({ kind: "panel" })}>…</div>
```

## Checklist

- [ ] No hex, `rgb()` or Tailwind palette colour in components; new tokens have a comment.
- [ ] Text uses `ink`, `ink-soft` or `ink-muted` on light, white tones on dark; pairs checked.
- [ ] Red used for its one meaning (`danger` or `empty`), not both.
- [ ] Font sizes from the existing steps; rich text inside `.prose-atlas`.
- [ ] Photos through `photoUrl`, credited with `PhotoCredit`; hero alt left as the title.
- [ ] Icons from lucide; radius and shadow follow the table above.
- [ ] Storybook story shows the new variant in light and dark tone.

## Anti-patterns

- `text-[13px] text-[#555]` in a new component: bypasses the tokens and fails contrast later.
- Using `empty` red for an error or `danger` red for a missing topic: readers learn the wrong
  meaning.
- A third font or a new size step "just here": the scale fragments quickly.
- A shadow on every card: depth stops meaning "floating".
- Copying a button's classes to make a slightly different button: add a variant instead.

## Sources

Full list: [reference](reference.md#sources).

- Tailwind CSS 4 theme variables: https://tailwindcss.com/docs/theme
- Vercel Web Interface Guidelines (contrast of states, radius, shadows, motion): https://vercel.com/design/guidelines
- Butterick, Practical Typography key rules: https://practicaltypography.com/summary-of-key-rules.html
- Linear UI redesign (few tokens, rare accent): https://linear.app/now/how-we-redesigned-the-linear-ui
- Datawrapper, colours in data visualisation: https://www.datawrapper.de/academy/what-to-consider-when-choosing-colors-for-data-visualization
