# atlas-accessibility: reference

Manual test script, WCAG 2.2 additions and sources for [SKILL.md](SKILL.md).

## What the automated tests cover (and what they do not)

| Check | File | Runs | Covers |
|---|---|---|---|
| axe (serious and critical only) | `tests/a11y.spec.ts` | Nightly e2e ([Full tests](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/actions/workflows/full-tests.yml)), locally with `npm run test:e2e` | About 20 public pages, the 404 quiz, the open account menu, skip link, unique field ids |
| Overflow | `tests/overflow.spec.ts` | Same | No sideways scroll and no text sticking out at 320, 375, 1280 px |
| Lighthouse accessibility | `lighthouserc.json` | Nightly | Score at least 0.9 on 4 URLs |
| Errors per field | `tests/unit/public-form-errors.test.ts` | Every PR (`npm test`) | Public forms return a message code for every invalid field, so each error sits under its own field |

axe runs with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and skips the globe canvas.
It does not test the WCAG 2.2 additions, keyboard flows, reading order or the quality of alt text.
Those need the manual script below. Adding `wcag22aa` to the tag list is welcome once it passes.

## WCAG 2.2 AA additions and where they matter in Atlas

| Criterion | What it asks | Atlas places to check |
|---|---|---|
| 2.4.11 Focus Not Obscured (AA) | The focused element is not fully hidden | Sticky header, `ReadingProgress`, `TopicJumpBar`, cookie notice, floating buttons, mobile bottom sheet |
| 2.5.7 Dragging Movements | A single-pointer alternative for every drag | Globe (zoom buttons, lists), `Rail` arrows, admin reordering (`moveActions`), custom map builder |
| 2.5.8 Target Size (Minimum) | 24 × 24 px or enough spacing | DataTable row icons (24 px mouse, 44 px touch), chips, pagination dots in `Rail` |
| 3.2.6 Consistent Help | Help in the same place on every page | Contact link and footer links stay in the same place |
| 3.3.7 Redundant Entry | Do not ask again for data given in the same flow | Volunteer form prefill (`volunteerHref`), checkout |
| 3.3.8 Accessible Authentication (Minimum) | No cognitive test to sign in | Email code and Google sign-in, 2FA code field |

## Manual test script (about 15 minutes per new screen)

1. **Keyboard.** Unplug the mouse. Tab from the address bar: the first stop is "Skip to content".
   Reach every control, open and close every menu, dialog and panel with Enter, Space and Esc.
   Focus must stay visible and return to the trigger.
2. **Screen reader.** NVDA (Windows) or VoiceOver (macOS, iOS). List the headings: one h1, no
   skipped levels. List the buttons: every icon button has a name. Trigger Share, a form error,
   a filter: each is announced once.
3. **Zoom and reflow.** 200 % browser zoom, then a 320 px wide window. Nothing is cut off; only
   tables, carousels and maps scroll sideways in their own box.
4. **Touch.** On a phone: tap targets are easy to hit, the bottom sheet opens and closes, one tap on
   the globe opens a place, nothing needs hover.
5. **Motion.** Turn on "reduce motion" in the OS: the coin, spark, pulse, stars and globe spin stop.
6. **Colour.** Check new colour pairs against the table in `atlas-visual-design`. Turn on forced
   colours (Windows high contrast): controls still have visible borders.
7. **Content.** Read the alt texts aloud: do they say what matters? Do maps and charts have the
   text or table alternative?

## Pattern notes

- **Dialog.** `Dialog` uses `showModal()`, so the browser handles inertness outside it; the Close
  button is the first focusable element, which keeps the destructive action away from the
  initial focus.
- **Panel Esc.** `ContentRail` ignores Esc when an `aria-modal` dialog is open or the key comes from
  a field, dialog or menu (`belongsToField`). New page-wide shortcuts follow the same guard.
- **Live regions.** Render the region empty on mount and fill it on change; a region inserted
  together with its text is often not announced.
- **Forms.** `ActionStatus` focuses the first `[aria-invalid="true"]` field after a failed save,
  otherwise scrolls the message into view with `scrollBehavior()`.

## Accessibility statement

The public statement lives at `/accessibility` and is edited in
[Admin → Site pages → Accessibility](https://atlas-of-todays-world.vercel.app/admin/pages/accessibility).
Update it when a known limitation is added or removed.

## Sources

- WCAG 2.2 quick reference: https://www.w3.org/WAI/WCAG22/quickref/
- What is new in WCAG 2.2: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- WAI-ARIA APG patterns (dialog, tabs, menu button, carousel, disclosure): https://www.w3.org/WAI/ARIA/apg/patterns/
- APG landmarks: https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/
- W3C tables tutorial: https://www.w3.org/WAI/tutorials/tables/
- W3C complex images tutorial: https://www.w3.org/WAI/tutorials/images/complex/
- Understanding use of colour: https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
- Understanding non-text contrast: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- Chartability critical tests: https://chartability.github.io/POUR-CAF/
- GOV.UK error summary: https://design-system.service.gov.uk/components/error-summary/
- Maps accessibility guidance (Hedron): https://hedron.readthedocs.io/en/latest/guides/maps-accessibility/
- NPS web map accessibility: https://www.nps.gov/maps/web/accessibility
- Vercel Web Interface Guidelines: https://vercel.com/design/guidelines
- Next.js production checklist (local copy `node_modules/next/dist/docs/01-app/02-guides/production-checklist.md`): https://nextjs.org/docs/app/guides/production-checklist
