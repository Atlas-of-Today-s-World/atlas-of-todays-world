---
name: atlas-content
title: Content and editorial quality
description: How to write, source, illustrate and publish content in the Atlas of Today's World encyclopedia — regions, global issues, countries, topics with subtopics, news, timelines, FAQ, key-fact cards, site pages and UI texts. Use when drafting or editing any text in the admin, checking a draft before approval, citing sources, adding photos or credits, choosing a title or URL, scheduling a publication or fixing an error.
roles: [editor, admin-user]
---

# Content and editorial quality

The Atlas is an English encyclopedia of the present. Readers trust it because every claim can
be checked. **Answer first, stay neutral, cite everything a reader could doubt.** This skill is
for editors working in the [administration](https://atlas-of-todays-world.vercel.app/admin)
and for AI agents drafting text for them.

## Before you start

- Working in the admin screens (forms, lists, permissions): `atlas-admin`.
- Search titles, descriptions, keywords: `atlas-seo`. The "In short" block and AI answer engines: `atlas-geo`.
- Charts, maps, data layers and their sources: `atlas-maps-data`.
- Field limits, source hierarchy and credit formats in full: [reference](reference.md).

## The content model (what you can write, and where)

| Content | Public URL | Edit in the admin |
|---|---|---|
| Region portrait (9 regions) | `/region/<slug>` | [Regions & countries](https://atlas-of-todays-world.vercel.app/admin/regions) |
| Global issue, or custom region (a group of countries) | `/global-issue/<slug>` | [Global issues](https://atlas-of-todays-world.vercel.app/admin/global-issues) |
| Country profile and facts | `/country/<slug>` | [Regions & countries](https://atlas-of-todays-world.vercel.app/admin/regions) → the country |
| Topic (encyclopedia dossier) with subtopics | `/topics/<slug>` | [Topics & news](https://atlas-of-todays-world.vercel.app/admin/content) (kind "Topic") |
| News article | `/news/<slug>` | [Topics & news](https://atlas-of-todays-world.vercel.app/admin/content) (kind "News article") |
| Author profile (bio, positionality statement) | `/authors/<slug>` | [Author profiles](https://atlas-of-todays-world.vercel.app/admin/authors) |
| Site pages: about, privacy, terms, accessibility | `/about` … | [Site pages](https://atlas-of-todays-world.vercel.app/admin/pages) |
| UI texts (buttons, headings, labels) | everywhere | [UI texts](https://atlas-of-todays-world.vercel.app/admin/site/texts) |
| Home page pinned subtopics | `/` | [Home page](https://atlas-of-todays-world.vercel.app/admin/home) |

- **Topic** (`entries.kind = "entry"`): title, summary, up to 5 summary bullets, category, region or
  global issue, countries, header photo with credit, author, body. The editor has tabs (`?tab=`):
  Article, Subtopics (max 12, `MAX_CHAPTERS`), Timeline, Maps & charts, Learn more (max 24 tiles,
  200 links), SEO & GEO (with the FAQ, max 20 questions).
- **Subtopic** (`entry_chapters`): title, up to 5 summary bullets, body, illustration with credit,
  optional audio. It gets the anchor `#topic-N` on the topic page.
- **Portrait sections** of a region or global issue: intro, key-fact cards (`portrait_metrics`),
  resources, FAQ, timeline, Maps & charts. Up to 50 items per list.
- **Key-fact card**: big value ("24.4 %"), label, one explaining sentence, **source (required)**,
  source link, year or period. A card without a source cannot be saved.
- **Timeline**: max 60 events, each with a date, rich text and up to 20 sources (https links).
- **Categories** (`NEWS_CATEGORIES`): Living Conditions, Political System, Society,
  International Relations, Historical Roots. They group into four portrait groups.
- **Content status** of a region or global issue: not started (grey on the globe, asks for
  support), in preparation (hourglass), ready (check mark). Keep it honest — readers fund
  regions based on it.
- **"Planned topic only"** (status `planned`) shows a grey "Coming soon" tile on the portrait. It is
  not a scheduled publication (see below). The admin list currently labels it "Scheduled".

## Rules

### Voice and style

- Write in English, British spelling (the site uses "organisation", "labour", "programme").
- Answer first. The first sentence of a summary defines the subject; the first two paragraphs
  carry the key facts. A reader who stops there must still be informed.
- Write summary bullets as 3–5 standalone claims, each ≤ 300 characters, each backed in the text below.
- Keep sentences ≤ 25 words and paragraphs ≤ 5 sentences. Use active voice.
- Spell out every acronym and explain every specialist term on first use ("the Organization for
  Security and Co-operation in Europe (OSCE)").
- Start headings with their most informative words. Use H2 for sections, H3 below; never skip a level.
- Use lists only for real lists or steps. Bold a few key phrases, never whole sentences.
- Write numbers with their unit and year: "about 6.9 million refugees (UNHCR, mid-2025)".
- Dates in full and unambiguous: "24 February 2022". Never "recently", "this year", "last month".

### Neutral point of view

- Represent each significant view in proportion to its weight in reliable sources. Say who holds
  it and whether it is the majority or a minority view.
- Attribute contested framings: "The Russian government describes the war as a 'special
  military operation'." Never adopt a party's label as the Atlas's own voice.
- Avoid loaded words (regime, terrorist, martyr, so-called) unless you quote and attribute them.
- No original synthesis: do not combine two sources into a conclusion neither of them states.
- Label analysis and opinion as such. News reports facts; topics explain context.
- Disputed borders and names follow the Atlas's UN-based territory policy (`atlas-maps-data`). Use
  one name per place across the site; give the alternative name once, attributed.
- Living people: contentious claims need strong sources, allegations are worded as allegations
  with the denial, birth date only if widely published, no private contact data.

### Sourcing and citations

- Cite every figure, quote and contested claim with a link a reader can open. In rich text, link
  the source in the sentence or add a numbered note.
- Prefer primary data sources for numbers (UN agencies, World Bank, national statistics offices,
  V-Dem, UNHCR) and reputable secondary sources (scholarly work, major news agencies) for
  interpretation. Use government statements for what the government says, not as fact.
- Do not cite social media, anonymous blogs or AI chatbots. Do not cite Wikipedia — cite what it cites.
- Every number carries its "as of" date: the year of the data, not the year you looked it up.
  Mark estimates and projections.
- Key-fact cards, manual indicator values and timeline events must name their source; the database
  refuses them otherwise. Do not fill the source field with "various" or "own research".
- Drafting with AI: check every fact and every link yourself before saving. Never publish an
  AI-suggested citation you have not opened.

### Corrections (suggested policy — owner to confirm)

- A **correction** fixes a wrong fact; an **update** reflects a changed situation; a
  **clarification** fixes ambiguous wording. Never silently fix a factual error in a published text.
- For a correction, add a dated line at the end of the article body: "Correction (16 October
  2026): An earlier version said X. It is Y." Updates can use "Update (date): …".
- Fix it as soon as it is confirmed. The revision history keeps the old version.
- The site has no public corrections log or report form yet; proposing one is an owner decision.

### Images

- Use only images you may republish: your own, public domain, Creative Commons (not ND if you crop),
  or Unsplash. Check the licence on the file page, not on a search result.
- Fill the credit field every time (header photo, subtopic illustration, tile photo, region and issue
  hero). Credit the **author**, then the source and licence: "Jane Doe / Wikimedia Commons, CC BY-SA 4.0
  (cropped)". Unsplash needs no credit by law; give "Name / Unsplash" anyway.
- Upload JPEG, PNG, WebP or AVIF up to 3 MB (no SVG). Audio up to 50 MB.
- Hero images use the page title as their alt text. This is an owner decision — keep it; do not add
  a separate alt field or change those texts.
- In "Maps & charts", an image's **title** is its alt text and the heading under it: describe what the image
  shows and why it matters, not "Photo of…".
- Images inside rich text need an alt attribute that says what the image adds.
- No identifiable private individuals in distress without consent; personality rights apply on top of the licence.

### Titles and URLs (slugs)

- Titles: plain, specific, answer-first ("Why the Sahel's juntas left ECOWAS"), ≤ 200 characters;
  keep them short enough to read in one glance. The search title is set separately (`atlas-seo`).
- Slugs: lowercase words and hyphens, no dates, no stop-word padding. Decide before publishing.
- A **published** article keeps its URL: the slug field locks. To move it anyway, ask a developer.
- Renaming an **author** URL leaves a permanent redirect automatically.
- Renaming a **global issue or custom region** does not: add the redirect yourself in
  [URL redirects](https://atlas-of-todays-world.vercel.app/admin/redirects) (old path → new path).
  The database refuses loops.

### Publishing, scheduling and revisions

- Workflow: draft → submit for approval (pending) → approve and publish. An approver can send it
  back with a note. Anyone in the admin team may edit any content; do not add extra sign-off steps.
- **Scheduled publication**: approve with a time instead of now (5 minutes to 1 year ahead). The
  database publishes it within 5 minutes of that time and the site shows it within an hour. If
  someone other than the scheduler edits the article meanwhile, the schedule is cancelled.
- Share an unpublished draft with a preview link (24 h, 3 days, 7 days or 30 days).
- Each save to the database is a revision; compare versions before approving. Autosave only keeps
  a backup in your browser — save before you close the tab.
- Site pages have their own revisions with restore, and a "Last updated" date: set it whenever
  the page meaningfully changes.
- Re-read fast-moving topics at least every 3 months; update figures and the "as of" dates.

### UI texts and site pages

- UI text overrides keep the `{placeholders}` of the original exactly (same names); the form refuses
  others. Max 2,000 characters. Sign-in, account and invitation texts are locked; menu labels are
  edited in [Site menus](https://atlas-of-todays-world.vercel.app/admin/site/navigation).
- Site page bodies may use `{{contact}}`, `{{email}}` and, on About, `{{data-sources}}` (the live list of data sources).

## How it connects to SEO and GEO

The SEO & GEO tab of a topic holds the search title (≤ 70), description (≤ 170), keywords (≤ 12),
share image (1200×630), "In short" summary (≤ 800, shown on the page) and noindex. Empty fields
fall back to the title and summary. Writing rules for them: `atlas-seo` and `atlas-geo`.

## Checklist before you submit or approve

- [ ] Summary answers the main question in its first sentence; 3–5 bullets, each backed in the text.
- [ ] Every figure has a source link and an "as of" year; estimates are marked.
- [ ] Contested claims attributed; no loaded labels in the Atlas's own voice.
- [ ] Acronyms spelled out on first use; sentences ≤ 25 words.
- [ ] Every image has a licence you checked and a credit; chart and image titles describe them.
- [ ] Key-fact cards and timeline events have sources; content status of the portrait is accurate.
- [ ] Slug final before first publication; a renamed global issue has a redirect.
- [ ] SEO & GEO tab filled or deliberately left to defaults (`atlas-seo`, `atlas-geo`).
- [ ] Revision diff checked before approving.

## Anti-patterns

- "Experts say…" with no named expert or source — unverifiable.
- Pasting a figure without its year — it silently becomes wrong.
- Fixing a factual error without a correction note — readers who quoted us cannot see why.
- Using an image found on a search engine — licence unknown, credit impossible.
- Writing "Photo of a protest" as an image title — says nothing a screen reader user needs.
- Changing a published slug or a global issue slug without a redirect — breaks every link out there.
- Copying text from a source — paraphrase and cite; quote at most a short sentence, attributed.

## Sources

- Wikipedia: Core content policies — https://en.wikipedia.org/wiki/Wikipedia:Core_content_policies
- Wikipedia: Reliable sources — https://en.wikipedia.org/wiki/Wikipedia:Reliable_sources
- Wikipedia: Biographies of living persons — https://en.wikipedia.org/wiki/Wikipedia:Biographies_of_living_persons
- BBC Editorial Guidelines: Accuracy — https://www.bbc.com/editorialguidelines/guidelines/accuracy
- The Trust Project: Trust Indicators — https://thetrustproject.org/trust-indicators/
- GOV.UK: Writing clearly — https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/
- NN/g: F-shaped reading pattern — https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/
- Wikimedia Commons: Reusing content — https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia
- Creative Commons: Recommended practices for attribution — https://wiki.creativecommons.org/wiki/Recommended_practices_for_attribution
- Unsplash License — https://unsplash.com/license
- More sources and full field limits: [reference](reference.md)
