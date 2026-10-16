---
name: atlas-geo
title: GEO (AI answer engines)
description: Generative Engine Optimization for the Atlas: being found, understood and cited by ChatGPT, Claude, Perplexity, Copilot and Google AI Overviews. Covers the robots.txt policy for AI bots, llms.txt and llms-full.txt, .md twins, server-rendered text for non-JS crawlers, answer-first writing, quotable sourced facts, entity clarity (Wikidata), honest freshness and geographic signals. Use when writing or templating content, adding a public page type, or changing robots, llms.txt or markdown routes.
roles: [editor, frontend]
---

# GEO: being cited by AI answer engines

Answer engines quote pages they can fetch without JavaScript, understand as clear entities,
trust (sources, named authors, honest dates) and lift as self-contained passages. Classic SEO
(`atlas-seo`) is the base: Google's AI features need no special files, only an indexable page
with good text. Everything here adds to it.

## Before you start

- Related skills: `atlas-seo` (canonical, sitemap, dates, JSON-LD builders), `atlas-content`
  (house style for writers), `atlas-architecture` (static/ISR rule), `atlas-maps-data`
  (globe, indicators), `atlas-performance`.
- Decision record: ADR-021 in `docs/architecture/10-rozhodnuti-adr.md` (open to AI crawlers).
- Tests: `src/lib/seo/llms-robots.test.ts`, `src/lib/seo/markdown.test.ts`,
  `src/features/seo/documents.test.ts`, e2e `tests/seo.spec.ts`.
- Bot tables, llms.txt anatomy and evidence: [reference](reference.md).

## Rules

### Crawler access (robots.txt)
- Today's policy (owner decision): every search engine, AI search/assistant bot and AI training
  bot is allowed. `ALLOWED_BOTS` in `src/lib/seo/robots.ts` names them in three groups, and
  `robotsRules()` gives the named group the same rules as `*`: allow `/`, disallow only `/api/`,
  `/admin`, `/auth/` and `PRIVATE_PATHS`.
- Never block a search or retrieval token: Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User,
  Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User. Blocking OAI-SearchBot alone
  removes the Atlas from ChatGPT search answers.
- Training tokens (GPTBot, ClaudeBot, CCBot, Google-Extended, Applebot-Extended, Amazonbot,
  Meta-ExternalAgent) stay allowed. Closing one is an owner decision; do it by moving the
  token into its own `Disallow` group, never by IP or user-agent blocking. Disallowing
  Google-Extended also stops Gemini grounding, but not Google Search.
- Bots must reach robots.txt and pages: make sure Vercel Firewall or bot protection never
  challenges or 403s the allowed bots
  ([Vercel team](https://vercel.com/atlas-of-today-s-world) → project → Firewall).
- A new bot token goes into the right group of `ALLOWED_BOTS` with its operator, and
  `llms-robots.test.ts` is updated.

### Rendering for crawlers that don't run JavaScript
- GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot and CCBot fetch HTML and do not execute JS.
  Main text, headings, numbers with their sources, author, dates and navigation links must be
  in the server-rendered HTML.
- Every client-only view (globe, charts, embeds in `VisualsCarousel`, map visuals) has a text
  equivalent (rule in `atlas-maps-data`). For crawlers it must be in the server HTML: a short
  summary and the key numbers with source and year.
- Public routes stay prerendered (`atlas-architecture`; CI guard
  `scripts/check-static-routes.mjs`). Next 16 caveat: on a dynamic route, `generateMetadata`
  output is streamed into `<body>` for any user agent not in `htmlLimitedBots`. The default list
  (`node_modules/next/dist/shared/lib/router/utils/html-bots.js`) covers Google, Bing and social
  bots but not GPTBot, OAI-SearchBot, ClaudeBot, Claude-SearchBot or PerplexityBot. Those bots
  would then miss title, canonical and description. Keep the route static. If one ever must be
  dynamic, set `htmlLimitedBots` in `next.config.ts` to the default pattern plus those tokens
  (the option replaces the default list, it doesn't extend it).
- Keep redirects to one hop and old slugs as 308 forever (`atlas-seo`): AI indexes keep stale
  URLs for a long time.

### llms.txt and llms-full.txt
- `/llms.txt` and `/llms-full.txt` are route handlers (`src/app/[locale]/llms.txt/route.ts`,
  `llms-full.txt/route.ts`, both `llmsRoute()` from `src/features/seo/feeds.ts`). Content comes
  from `getLlmsTxt` / `getLlmsFullTxt` (`src/features/seo/queries.ts`); the format is built by
  `llmsTxt` / `llmsFullTxt` (`src/lib/seo/llms.ts`).
- They read the same cached DB queries as the sitemap, so they never list a page that 404s.
  Never hand-edit a static llms file.
- Shape (llmstxt.org): H1 site name, `>` summary, short detail paragraphs, H2 sections of
  `- [Name](url): note`, a final `## Optional` section. Keep the citation-format note.
- A new public section is added to `getLlmsTxt` in the same PR that adds it to the sitemap.
- `llms-full.txt` is about 800 KB. Split it per section if it grows past a few MB.
- Every page links it: the `[locale]` layout emits `<link rel="describedby">` to llms.txt and
  the RSS/Atom alternates. Keep them.
- llms.txt is a community proposal, not a standard, and Google ignores it. Keep it accurate;
  don't invest beyond that.

### Markdown twins
- Articles have `.md` twins: `/topics/<slug>.md` and `/news/<slug>.md`. `src/proxy.ts` rewrites
  them to `src/app/[locale]/md/[kind]/[slug]/route.ts`, which renders `articleMarkdown()`
  (`src/features/seo/documents.ts`) with an HTTP `Link: <html url>; rel="canonical"` header.
- A page advertises its twin with `pageMetadata({ markdown: true })`
  (`<link rel="alternate" type="text/markdown">`). Set it only when the twin exists: never
  advertise a 404.
- Adding a twin for another page type means extending the route's `kind` check and
  `generateStaticParams`, the proxy's `.md` rewrite, a document builder in `documents.ts`, and
  `markdown: true` on that page, in one PR.

### Answer-first content (editors and templates)
- Open every topic, news item, country, region and issue page with an "In short" answer of 2–3
  sentences that names the entity, the place and the time ("As of 2025, …").
- For topics, editors write it in the article's SEO form, field "In short (GEO)"
  (`geo_summary`, max `GEO_SUMMARY_MAX` = 800 characters). `EncyclopediaArticle` shows it at
  the top of the dossier and the page feeds it to JSON-LD `abstract`. Any new "In short" field
  works the same way: visible first, then structured data.
- Write sentences that stand alone when quoted: never start with "This", "It" or "The above".
- Use question-shaped H2/H3 headings where natural ("Who counts as a refugee?"), each followed
  by a direct one- or two-sentence answer.
- Every statistic in text has value, unit, year, named source and a link, in HTML text, not
  only in a chart or on the globe. Indicator cards already do this (`MetricCards`, `SourceLink`
  in `src/components/atlas/ui.tsx`).
- Quote primary voices (treaty text, a UN body, a named expert) briefly, in `<blockquote>` with
  `<cite>`. Cite sources inline as real `<a href>` links to primary sources (UNHCR, World
  Bank, UNDP, V-Dem) and keep the resource list (it becomes JSON-LD `citation`).
- Never stuff keywords or lists of place names: it scores below baseline in the GEO study and is
  a Google spam pattern.
- Don't hide key answers in images, PDFs or closed widgets. Tabs and accordions are fine.

### Entity clarity
- One canonical name per entity everywhere: title, H1, JSON-LD `name`, llms.txt. Formal or
  other names go into `alternateName` (countries: `nameFormal`).
- Link entities to Wikidata. Countries: `countrySameAs(iso3)` reads
  `src/config/wikidata-countries.json` (Wikidata + English Wikipedia). The organization's
  `sameAs` comes from `src/config/organization.ts` and site settings. Add `sameAs` for a region
  or issue only when a matching Wikidata item really exists.
- Articles name their places with the same `@id`s: `about` (countries) and `contentLocation`
  (region) in `articleNode`.
- Named authors with a real profile page are the strongest "who" signal; author rules are in
  `atlas-seo`.

### Freshness, honestly
- Visible "Published"/"Updated" dates, JSON-LD dates and sitemap `lastmod` agree and move only
  on real content changes. That rule lives in `atlas-seo` (§ Dates, § Sitemaps). Never refresh
  dates to look current: engines learn to ignore them.
- Say "As of <year>" in text next to time-sensitive facts, so a quoted sentence stays true.
- IndexNow (`atlas-seo`) is the fast path into Bing, which grounds Copilot and ChatGPT search.

### Geographic signals
- Place identity lives in JSON-LD, not meta tags. `countryNode` emits `Country` with ISO 3166-1
  alpha-2/alpha-3 `identifier`s, Wikidata/Wikipedia `sameAs`, `geo` (`GeoCoordinates`),
  `containedInPlace` (region) and indicator values with source and year (`additionalProperty`).
  `groupPlaceNode` emits a region or issue with `containsPlace` (its countries).
- `geoMeta()` (`src/lib/seo/index.ts`) writes `geo.position`, `geo.region`, `ICBM` and
  `place:location:*`. Google ignores them; they are legacy and harmless. Use them only for real
  places (countries, regions). Don't add new ones and don't spend effort on them.

### Measuring
- Google AI Overviews and AI Mode clicks are inside Search Console Performance → "Web"; there is
  no separate filter. Bing Webmaster Tools has an AI Performance report (Copilot citations).
  Links: [atlas-seo reference](../atlas-seo/reference.md#tools-and-deep-links).
- Watch AI referrers (`chatgpt.com`, `perplexity.ai`, `claude.ai`, `copilot.microsoft.com`) in
  Vercel Analytics, and bot user agents in the Vercel logs.

## Checklist

- [ ] No search or retrieval bot blocked; robots change has an owner decision behind it.
- [ ] Main text, numbers with sources, author and dates are in the server HTML (view source).
- [ ] Route stays prerendered (no `htmlLimitedBots` workaround needed).
- [ ] New public section is in `getLlmsTxt` and the sitemap.
- [ ] `markdown: true` only where the `.md` twin returns 200.
- [ ] Page opens with a visible "In short" answer naming entity, place and time.
- [ ] Every statistic: value, unit, year, source, link, as text.
- [ ] Entity names consistent; `sameAs` only to the right Wikidata item.
- [ ] No keyword or place-name stuffing; no fake freshness.

## Anti-patterns

- Blocking AI bots "to protect content": the Atlas exists to be read and cited (ADR-021).
- Putting the key numbers only on the globe or in a chart: non-JS crawlers see nothing.
- A JSON-LD `abstract` or FAQ that readers can't see: a mismatch, and untrusted.
- Making a public route dynamic: metadata streams into `<body>` for AI bots, and the CDN cache
  is lost (`atlas-performance`).
- Writing for bots (place-name lists, "best atlas" phrases): measurably worse.

## Known gaps (2026-10-16)

1. Map pages carry little server-rendered text: about 1.0 k characters on `/`, 1.5 k on
   `/region/east-asia`, 2.0 k on `/global-issue/energy-transition`, 2.4 k on `/country/china`,
   against about 28 k on a topic. Add a server-rendered "In short", a key-facts block with
   source and year, and links to related articles.
2. No `.md` twins for countries, regions and issues (`/country/china.md` returns 404).
3. Only topics have an editor-written "In short" (`geo_summary`, rendered by
   `EncyclopediaArticle`). News, countries, regions and issues have no equivalent field yet.
4. `geoMeta` is also emitted on global issues and on news (with region centroids such as
   `0;20`); an issue is not a place. Low priority.

## Sources

[GEO paper, Aggarwal et al., KDD 2024](https://arxiv.org/abs/2311.09735) ·
[Google, AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) ·
[Microsoft, content for AI search answers](https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers) ·
[llms.txt](https://llmstxt.org/) · [Vercel, AI crawlers and JS](https://vercel.com/blog/the-rise-of-the-ai-crawler).
Full list in [reference](reference.md#sources).
