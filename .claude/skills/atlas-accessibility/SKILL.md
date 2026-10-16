---
name: atlas-accessibility
title: Accessibility
description: WCAG 2.2 AA for Atlas of Today's World - semantics, keyboard and focus (panels, Esc, dialogs, menus, tabs, the Rail carousel), skip link, touch targets (--touch-min), reduced motion, contrast, the globe and maps with HTML alternatives, accessible forms and errors, screen-reader announcements, and the repo's axe and overflow tests. Use when building or reviewing any UI, adding an interactive control, a dialog, a form, an animation, an image or a map, or when a11y tests fail.
roles: [designer, frontend, everyone]
---

# Accessibility

The bar is **WCAG 2.2 level AA** on every public page and in the admin. Prefer native HTML,
reuse the components that already behave correctly, and never ship something a keyboard,
a screen reader or a 320 px phone cannot use.

## Before you start

- Run the checks: `npm run test:e2e -- tests/a11y.spec.ts tests/overflow.spec.ts` (needs a production
  build: `npm run build`, Playwright starts `npm run start`). Both run nightly in
  [Full tests](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/actions/workflows/full-tests.yml),
  together with Lighthouse (accessibility score at least 0.9, `lighthouserc.json`).
- Related skills: `atlas-visual-design` (token contrast table), `atlas-ux` (flows and states),
  `atlas-frontend` (component rules), `atlas-maps-data` (chart and map content), `atlas-content`
  (alt text wording, plain language).

## Rules

### Structure and semantics

- One `<h1>` per page; headings go h1 → h2 → h3 without skipping. Panel and full pages keep their
  own `h1`; the home page has a visually hidden one.
- Landmarks: `header`, `nav` (each labelled when there is more than one), `main id="content"
  tabIndex={-1}`, `footer`. The panel is an `aside` that takes focus.
- Native elements first: `button`, `a`, `label`, `details`, `dialog`, `table`. A clickable `div`
  is a bug.
- Icon-only controls carry `aria-label` (and `title` where a tooltip helps); every lucide icon
  next to text is `aria-hidden`.
- `<html lang="en">` is set in `src/app/layout.tsx`; content in another language marks its own
  `lang` (as `<article lang={item.locale}>` does).

### Keyboard and focus

- Everything works with the keyboard alone. Focus is always visible (`focus-visible:ring-2` on
  `buttonVariants`, a 3 px outline on the globe canvas). Never remove an outline without a
  replacement.
- The skip link (`SKIP_LINK` in `src/config/layout.ts`) is the first Tab stop and jumps to
  `#content`. On the home page a second hidden link leads to the plain list of places.
- Esc closes the innermost thing: an open dialog or menu first, then the panel (`ContentRail`).
  Page-wide shortcuts must ignore keys that belong to a field, dialog or menu (`belongsToField`
  in `src/lib/keyboard.ts`).
- When content appears, focus moves to it (`ContentRail` focuses the panel on open; a subtopic
  heading is `tabIndex={-1}` so Previous / Next can land on it). When it closes, focus returns to
  the trigger.
- Use the existing widgets; they implement the WAI-ARIA patterns:

| Need | Component | Keyboard |
|---|---|---|
| Modal | `Dialog` (`components/ui/dialog.tsx`, native `<dialog>`) | Focus inside, Esc closes, focus returns |
| Full-screen menu | `useFocusTrap` (`src/lib/use-focus-trap.ts`) + Esc in the caller | Tab cycles inside |
| Menu / popover | `Popover` (`components/ui/popover.tsx`) | Arrows, Home, End, Esc |
| Tabs | `Tabs`, `TabPanel` (`components/ui/tabs.tsx`) | One tab stop, arrows, Home, End |
| Carousel | `Rail` (`components/atlas/Rail.tsx`) | ←/→, Home, End, labelled arrows, page announced |
| Disclosure | `Accordion` / `<details>` | Enter, Space |
| Confirmation | `ConfirmButton` (`components/admin/ConfirmButton.tsx`) | Dialog, Cancel before the action |

- Sticky bars and banners never cover the focused element (WCAG 2.4.11). Anchored headings
  under the sticky header need a scroll margin.
- Never trap Tab in the globe; Tab must pass through it.

### Pointer and touch

- Every target is at least 24 × 24 px with a mouse and 44 × 44 px on touch: `min-h-(--touch-min)`,
  `size-(--touch-min)`, `pointer-coarse:min-h-(--touch-min)` for dense controls, or the
  `touch-hit` utility for an invisible 44 px area around a small visual.
- Every drag has a single-pointer alternative: the globe has + / − buttons and a list of places,
  `Rail` has arrows, ordered lists have up / down buttons (`moveActions`).
- Never disable zoom.

### Motion

- `prefers-reduced-motion: reduce` stops all CSS animation and transition (kill-switch in
  `globals.css`). Scripts ask `scrollBehavior()` (`src/lib/motion.ts`) before smooth scrolling.
- Anything that moves for more than 5 s has a pause: the globe's idle spin has a Stop button and
  never starts with reduced motion (`useIdleSpin`). The owner's coin, spark and pulse animations
  stay; they stop under reduced motion.
- Nothing flashes more than 3 times a second.

### Colour and text

- Text contrast at least 4.5:1 (3:1 for text of 24 px, or 18.7 px bold, and larger); UI parts, icons,
  chart marks and map strokes at least 3:1 against their neighbours. Token pairs:
  `atlas-visual-design` reference.
- Never convey meaning by colour alone: a zero carries the number "0", statuses carry a
  label, form errors carry text.
- Pages reflow at 320 px with no sideways scroll (`tests/overflow.spec.ts` checks 320, 375, 1280);
  tables, carousels and maps may scroll in their own box.
- Text survives user spacing overrides (line height 1.5, letter spacing 0.12 em): no fixed-height
  text boxes.

### Images, the globe and maps

- Informative images have a non-empty alt (what to write: `atlas-content`); decorative ones get
  `alt=""` and `aria-hidden`. The hero photo's alt is the page title (owner decision). Photos set
  as CSS backgrounds that carry meaning use `role="img"` + `aria-label` (the author photo).
- The globe canvas is keyboard-operable (arrows pan, + / − zoom), focusable and outlined, and
  axe cannot test it (`tests/a11y.spec.ts` excludes `.maplibregl-canvas-container`). So every
  globe feature needs an HTML twin: `/countries` for places, the ranked list on `/view/[indicator]`
  for a data layer, search for jumping to a place, labelled zoom buttons (`GlobeZoomControls`).
- Selecting a place opens its panel, which takes focus; that is the announcement. Do not add a
  second live announcement for the same change.
- The globe window on full pages (`MiniGlobeLink`) is one labelled link, not an interactive map.
- Every chart and custom map has a title, a text summary of its takeaway and its data available
  as text or a table. Details: `atlas-maps-data`.
- Audio has a text alternative next to it and never autoplays (`EntryAudio`).

### Forms and errors

- Every control has a visible `<label>` (`FormField` with `id` = the control's `id`). Hints and
  errors are linked with `describedBy(id, { hint, errors })`, which also sets `aria-invalid`.
- Required fields: `required` on the control; `FormField required` shows the `*` and sets
  `aria-required`; the page explains `*` with `RequiredNote`.
- After a rejected submit, focus moves to the first invalid field: `ActionStatus` (admin) and
  `useFormErrors` (public forms) do this. Errors are text next to the field, never only colour or
  a tooltip.
- Inputs have the right `type`, `name`, `autocomplete` and `inputMode` (the 2FA code field uses
  `inputMode="numeric"` and `autoComplete="one-time-code"`); paste is never blocked.
- Sign-in (email code, Google) allows paste and password managers and never adds a memory or
  puzzle test (WCAG 3.3.8).

### Announcements

- Status changes the reader did not navigate to are announced in a polite live region:
  `ShareButton` (`role="status"`), `ActionStatus` (`status` / `alert`), `Rail` page changes,
  DataTable result counts, `TopicsBrowser` results.
- Use `role="alert"` only for errors that happen while the person is on the page (`ErrorState
  live` in error boundaries). A 404 page is just a page, not an alert.
- One live region per change; keep the message short ("Link copied", "3 results").

## How we do it in Atlas

```tsx
<FormField id="redirect-from" label="Old path" hint="E.g. /news/old-title" required errors={errors.from_path}>
  <Input id="redirect-from" name="from_path" required
    {...describedBy("redirect-from", { hint: "E.g. /news/old-title", errors: errors.from_path })} />
</FormField>

<Button variant="quiet" size="denseIcon" aria-label="Close" onClick={close}>
  <X aria-hidden className="size-4" />
</Button>
```

## Checklist

- [ ] Keyboard only: reach, operate and leave every control; focus visible; Esc closes the right thing.
- [ ] Screen reader (NVDA or VoiceOver): headings, labels, names of icon buttons, announcements.
- [ ] 320 px width and 200 % zoom: nothing cut off, no sideways page scroll.
- [ ] Touch: targets 44 px; no drag-only action.
- [ ] Reduced motion on: nothing moves.
- [ ] Contrast of new colour pairs checked; meaning not by colour alone.
- [ ] New public page added to `PAGES` in `tests/a11y.spec.ts` and `tests/overflow.spec.ts`.
- [ ] Images have meaningful or empty alt; maps and charts have a text or table alternative.

## Anti-patterns

- `<div onClick>` or a link without `href`: invisible to keyboard and screen readers.
- A hand-made modal without focus handling: use `Dialog`.
- `outline: none` with no replacement.
- A new animation that ignores reduced motion or cannot be paused.
- Information only on the globe or only in a tooltip.
- `role="alert"` on static content: screen readers interrupt and read it out of turn.
- Placeholder as the only label.

## Sources

Full checklist and sources: [reference](reference.md).

- WCAG 2.2 quick reference: https://www.w3.org/WAI/WCAG22/quickref/
- What is new in WCAG 2.2: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- WAI-ARIA Authoring Practices, patterns: https://www.w3.org/WAI/ARIA/apg/patterns/
- W3C complex images tutorial: https://www.w3.org/WAI/tutorials/images/complex/
- Chartability: https://chartability.github.io/POUR-CAF/
- Vercel Web Interface Guidelines: https://vercel.com/design/guidelines
