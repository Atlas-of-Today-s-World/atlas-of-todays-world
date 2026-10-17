# atlas-visual-design: reference

Details behind [SKILL.md](SKILL.md).

## Contrast of token pairs

WCAG 2.x ratios, computed from the hex values in `src/app/globals.css` (2026-10-16). The bar
itself (4.5:1 text, 3:1 large text and UI parts) is defined in `atlas-accessibility`.

| Foreground | Background | Ratio | Allowed for |
|---|---|---|---|
| `ink-soft` #474c63 | white | 8.5 | Body text |
| `ink-muted` #646a82 | white | 5.4 | Secondary text (lightest text colour on white) |
| `ink-muted` #646a82 | `paper` #f4f5f8 | 4.9 | Secondary text on paper pages |
| `link` #1f4fd8 | white | 6.6 | Links in prose |
| `accent` #3b4ce0 | white | 6.4 | Text, icons, white text on accent buttons |
| white | `patron` #2563eb | 5.2 | Patron buttons |
| `accent-bright` #7f97ff | `space` #0a1020 | 7.0 | Accent text on the dark layer |
| `patron-bright` #60a5fa | `space` #0a1020 | 7.5 | Headings on the dark band |
| `field-border` #8a90a6 | white | 3.2 | Outline of inputs and selects (meets 3:1 for UI parts) |
| `line` #c3c8d3 | white | 1.7 | Decorative dividers only; never the only outline of a control |
| `empty` #dc2626 | white | 4.8 | The red zero and its border |
| `empty-strong` #b91c1c | `empty-soft` #fef2f2 | 5.9 | Text of the zero-topics invitation |
| `status-ready-text` #16794a | white | 5.4 | "Ready" label; fill of a completed region's pills (white number) |
| `status-preparing-text` #9a6200 | white | 5.1 | "In preparation" label; fill of a planned region's pills (white number) |
| `status-ready` #1e9e5a | white | 3.5 | Icon only (with a text label) |
| `status-preparing` #d98a00 | white | 2.8 | Icon only, always next to a text label; never text |
| `success` / `warning` / `danger` | their `-soft` | 6.5 / 6.4 / 5.3 | Badges and result messages |
| land `#7d8aa8` (`GLOBE_COLORS.land`) | `space-deep` | 5.7 | Countries on the globe |

Re-run the numbers when a token changes (any WCAG contrast checker, or the formula in
https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

## Where the tokens live

| Kind | CSS | JS twin | Guard |
|---|---|---|---|
| Colours | `@theme --color-*` | `THEME_COLORS`, `PLAIN_MAP_COLORS`, `GLOBE_COLORS` in `src/config/palette.ts` | `palette.test.ts` |
| Fonts | `--font-display`, `--font-sans` | `next/font/google` in `src/app/layout.tsx` | — |
| Radius | `--radius-panel` | — | — |
| Stacking | `--z-index-*` | — | — |
| Layout | `:root --rail-width`, `--rail-width-wide`, `--touch-min`, `--mini-globe-*` | `RAIL`, `RAIL_WIDE`, `TOUCH_MIN_PX`, `MINI_GLOBE` in `src/config/layout.ts` | `layout.test.ts` |
| Utilities | `@utility touch-hit`, `.glass`, `.glass-hover`, `.panel-scroll`, `.prose-atlas`, `.prose-compact`, `.spark-ring`, `.coin-face` | `glassVariants`, `kickerVariants` | — |

## Known debt (do not copy)

- Many components use arbitrary values: `text-[Npx]` and `text-[var(--color-…)]`. New code uses
  the token utilities; old code is converted when touched.
- The `danger` Button variant uses Tailwind's `red-700` palette directly instead of a token.
- The glass surfaces, the MapLibre overrides and the topic pulse hold `rgba()` literals in
  `globals.css`; that file is the one place where raw values are allowed.

## Visual variants that already exist

| Component | Variants |
|---|---|
| `Button` / `buttonVariants` (`components/ui/button.tsx`) | variant: primary, outline, danger, patron, ink, ghost, quiet, quietDanger; size: md, sm, chip, icon, dense, denseIcon, rowIcon; `block` |
| `Badge` (`components/ui/badge.tsx`) | tone: neutral, accent, success, warning, danger, outline; size sm, md |
| `Note` (`EmptyNote`, `Lead`) | size xs, sm, md; tone soft, muted, inverse; leading |
| `kickerVariants` | tone pill, muted, glass |
| `glassVariants` | kind panel, pill |
| `Breadcrumbs` | tone light, dark |
| `Rail` | tone light, dark; layout scroll, grid, pages |
| `PhotoCard`, `PhotoTile` (`tileStyle`) | card and tile styles |

## Sources

- Tailwind CSS theme variables: https://tailwindcss.com/docs/theme
- Tailwind dark mode: https://tailwindcss.com/docs/dark-mode
- Vercel Web Interface Guidelines: https://vercel.com/design/guidelines
- Practical Typography, key rules: https://practicaltypography.com/summary-of-key-rules.html
- Baymard, line length: https://baymard.com/blog/line-length-readability
- GOV.UK type scale: https://design-system.service.gov.uk/styles/type-scale/
- Linear UI redesign: https://linear.app/now/how-we-redesigned-the-linear-ui
- Datawrapper, colours for data visualisation: https://www.datawrapper.de/academy/what-to-consider-when-choosing-colors-for-data-visualization
- FT Visual Vocabulary: https://github.com/Financial-Times/chart-doctor/blob/main/visual-vocabulary/README.md
- WCAG 2.2 contrast (minimum): https://www.w3.org/WAI/WCAG22/quickref/#contrast-minimum
- WCAG 2.2 non-text contrast: https://www.w3.org/WAI/WCAG22/quickref/#non-text-contrast
