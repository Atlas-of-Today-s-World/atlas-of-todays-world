---
name: atlas-ux
title: UX (reader experience)
description: How readers move through Atlas of Today's World and what every public screen must give them - globe, panel and full-page navigation, long-form topics with subtopics and timelines, answer-first blocks, loading/empty/error states, support and volunteer calls to action, sharing, URL state and phone behaviour. Use when designing or changing a public page, flow, panel, menu, empty state, call to action, share or filter, or anything a reader clicks.
roles: [designer, frontend, editor]
---

# UX: the reader experience

The reader never gets lost. Every screen answers first, keeps its state in the URL and
offers a next step. Build new screens from the existing levels, blocks and states below
instead of inventing new ones.

## Before you start

- Look at the real thing on a phone and a laptop: https://atlas-of-todays-world.vercel.app
- Related skills: `atlas-visual-design` (look and tokens), `atlas-accessibility` (keyboard,
  focus, contrast, screen readers), `atlas-content` (wording, sources, images), `atlas-maps-data`
  (globe layers, charts, legends), `atlas-performance` (loading budgets), `atlas-seo` (titles,
  URLs), `atlas-frontend` (how to build it).
- Public UI text lives in `src/messages/en.json` (English only). Editors override many strings in
  [Admin → UI texts](https://atlas-of-todays-world.vercel.app/admin/site/texts), so never hard-code
  reader-facing text in a component.

## Rules

### Three levels, one way in and out

| Level | Pages | Built with |
|---|---|---|
| Globe | `/` (home): satellite globe, layer switcher, search | `src/app/[locale]/(map)/page.tsx`, `src/components/map/*` |
| Panel next to the globe | country, region, news item, data layer (`/view/…`) | `ContentRail`; right column from 768 px (`DESKTOP_MIN_PX`), bottom sheet below |
| Full page over the globe | Topics, a topic, Global issues, a global issue | `FullPage`; the globe waits in a corner window (`MiniGlobeLink`) |

- Put a new page type into one of these levels. `railKind()` and `isFullPage()` in
  `src/config/layout.ts` decide which; extend their lists, never add a one-off check in a page.
- Closing a panel (X or Esc) returns to the globe (`ContentRail` `closeHref="/"`). Going one
  level up is the job of the breadcrumbs (`Breadcrumbs`: location trail, current page last and
  unlinked), not of the close button.
- The globe is never the only way to a place. `/countries` (`routes.countries`) lists every
  place; the home page's hidden skip link and `GlobeUnavailable` (no WebGL) both point there.
  A new kind of place must also appear in a plain list.
- A data layer on the globe always comes with its ranked HTML list (`/view/[indicator]`).
- Navigation is a real link (`Link` from `@/components/i18n/Link` on public pages), so
  Cmd/Ctrl-click, middle-click and "copy link" work. Never navigate with `onClick` + `router.push`
  when a link would do.
- On touch the first tap on a place previews it and the second opens it
  (`components/map/globe/tapPreview.ts`). Keep that contract for anything new on the globe.

### Long-form reading: topics, global issues, portraits

A topic page (`features/topics/components/EncyclopediaArticle.tsx`) has this order. Keep it
for every long-form type:

1. Hero: photo or colour wash, breadcrumbs, title, summary, Share (`ArticleHero`).
2. Meta line: places, reading time. Author, published and updated dates.
3. **In short**: the answer in a few sentences (`seo.geoSummary`, max 800 chars).
4. **Key points**: up to 5 bullets (`summaryPoints`; the schema allows 5).
5. Intro text, then the timeline (`Timeline`), then Maps & charts (`VisualsCarousel`).
6. Subtopic cards with the open subtopic below (`DossierExplorer`), then Learn more tiles.
7. FAQ (`FaqList`), author bio, end links (`ArticleEnd`).

- Answer first: the In short block and the key points come before any long text. Each
  subtopic opens with its own summary points. Wording rules are in `atlas-content`; the In short
  text is also the GEO summary (`atlas-geo`).
- A block with no data is not rendered at all (no timeline, no visuals, no FAQ → nothing, no
  empty heading). The one deliberate exception is the zero-topics invitation below.
- Subtopics have stable anchors `#topic-N` (`routes.topic(slug, "topic-N")`). Opening one writes
  the hash (`OpenOnHash`), so it can be shared and reloaded. Never change the anchor scheme.
- Show published and updated dates as `<time dateTime>`; show "Updated" only when it differs.
  Subtopics show their own updated date.
- Reading aids are `ReadingProgress` (sticky under the header, `UNDER_HEADER_BAR`) and, on phones,
  `TopicJumpBar`. Do not add another sticky bar.
- Timelines run oldest to newest in one `Rail` (limits: `atlas-content`).
- Optional depth goes into `<details>` (`Accordion`), which works without JavaScript. Never put the
  main answer inside a disclosure.

### States: loading, empty, error, not found

| Situation | Use |
|---|---|
| Slug route loading | `loading.tsx` with `RailSkeleton` (panel) or `FullPageSkeleton` (full page) |
| Empty list or "no results" | `EmptyNote`: say what is empty or what was searched, offer a next step |
| Place with zero topics | `NoTopicsCta` / `TopicsInvite`: red invitation to write (`volunteerHref(place)`) |
| Error inside a route | `error.tsx` rendering `RouteError` (on map pages the globe stays) |
| Not found | `not-found.tsx` rendering `ErrorState` (plus the country outline quiz) |
| Globe cannot start | `GlobeUnavailable` with a link to `/countries` |

- No indicator for waits under about 1 s. A skeleton must match the final layout; never ship a
  frame with an empty middle.
- Design every new view for four data states: empty, one item, typical, very long (long country
  names, 12 subtopics `MAX_CHAPTERS`, 24 tiles `MAX_TILES`).
- Show "no results" only after loading has finished.
- Every error and 404 screen offers a way back or forward (`ErrorState` `action` / `backLabel`).

### Support, patrons and volunteers

- Owner decisions, keep them: the gold coin animation (`DonateCoin`), the spark ring on "See all
  N topics" (`spark-ring`), the "Support the Atlas" floating button and menu item, and the red
  pulsing zero on the globe.
- `FloatingActions` (Newsletter + Support the Atlas) is the only floating call to action. It is on
  every public page except the admin and the donation pages. Do not add a second one.
- Keep support separate from editorial text: `PatronsCallout` and donation cards sit after the
  content or in their own box, never inside an article body.
- Button labels name the outcome: "Become a patron", "Write a topic", "Join as volunteer". Never
  "Continue", "Submit" or "Click here".
- Invitations prefill what is known: `volunteerHref(place)` opens the volunteer form with the place
  filled in. Never ask again for something the reader already gave in the same flow.
- Readers support without an account. Payments stay in Stripe test mode.

### Sharing

- One component: `ShareButton` (`components/atlas/ShareButton.tsx`). Phones get the system share
  sheet, other devices copy the link and see an announced "Link copied".
- Pass `hash` to share one subtopic; `tone="dark"` over photos.
- No Share on secret preview links: `EncyclopediaArticle` shows it only when the public page
  passes `share`.

### URL state and Back

- Everything a reader would share or return to lives in the URL: filters and search on index
  pages (`useUrlParams` / `setUrlParams` in `components/atlas/url-filters.ts`), the open subtopic
  (`#topic-N`), the search query (`routes.searchFor(q)`).
- Static index pages render the full list on the server and narrow it in the browser. Do not read
  `searchParams` in their server render; that makes the route dynamic (`atlas-architecture`).
- Filter tweaks use `replaceState` (no history spam); moving to another page is a real navigation.
- Back returns to the same scroll position. Every new scrolling container uses `useScrollMemory`
  or `RememberedScroll`.

### Phones

- The panel is a bottom sheet at 58 % of the height (`MOBILE_SHEET`); the place stays visible
  above it, and the handle expands it. Floating buttons and the cookie notice step aside for it;
  never pin another fixed element over the sheet.
- No sideways page scroll at 320, 375 and 1280 px (`tests/overflow.spec.ts`). Carousels and
  tables may scroll inside their own box.
- Nothing is hover-only: every hover hint has a tap equivalent.
- Touch target sizes and gestures: see `atlas-accessibility`.

## How we do it in Atlas

```tsx
// A place with no topics invites the reader to write the first one.
<NoTopicsCta count={topicCount} place={place.name} />
// Share one subtopic of a topic page.
<ShareButton title={chapter.title} hash={`topic-${index + 1}`} />
// Index page filter kept in the URL (client component).
const params = useUrlParams();
setUrlParams({ category: next || null });
```

## Checklist

- [ ] The page sits in one of the three levels; close, Esc and breadcrumbs lead somewhere sensible.
- [ ] Long-form content opens with In short and key points; empty blocks are not rendered.
- [ ] Loading, empty, error and very-long states exist and were checked.
- [ ] Shareable state (filters, open subtopic, query) is in the URL; Back restores scroll.
- [ ] Calls to action name the outcome; nothing is added beside `FloatingActions`.
- [ ] Checked at 320 px and on a touch device; nothing depends on hover.
- [ ] Reader-facing text comes from `en.json` via `getT()` / `useMessages()`.

## Anti-patterns

- A new modal or a fourth page level for content that fits a panel or a full page: readers lose
  the globe and the Back button.
- A spinner on a whole page, or a skeleton that does not match the page: it reads as broken.
- An empty heading ("Timeline" with nothing under it): it promises content that is not there.
- Filters kept only in React state: the view cannot be shared and Back loses it.
- A second floating donate button or a donation box inside the article text: it competes with the
  content and erodes trust.
- Removing the coin, the spark or the red zero to "calm the page": these are owner decisions.

## Sources

Full list with notes: [reference](reference.md).

- NN/g, F-shaped reading and front-loading: https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/
- NN/g, skeleton screens: https://www.nngroup.com/articles/skeleton-screens/
- NN/g, breadcrumbs: https://www.nngroup.com/articles/breadcrumbs/
- Vercel Web Interface Guidelines (URL state, links, states): https://vercel.com/design/guidelines
- Our World in Data topic page (key insights, dates): https://ourworldindata.org/co2-and-greenhouse-gas-emissions
- WCAG 2.2 new criteria (redundant entry): https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
