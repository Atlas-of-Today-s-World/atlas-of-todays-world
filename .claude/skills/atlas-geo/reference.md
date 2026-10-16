# GEO reference

Detail for [atlas-geo](SKILL.md).

## Bots by class

The Atlas allows all of these today (`ALLOWED_BOTS`, `src/lib/seo/robots.ts`).

### Search and retrieval (must stay allowed)

| Token | Operator | What it does | Notes |
|---|---|---|---|
| Googlebot | Google | Search, AI Overviews, AI Mode | robots.txt also governs Google's AI features; renders JS |
| Bingbot | Microsoft | Bing, grounding for Copilot and ChatGPT search | in Next's `htmlLimitedBots` default |
| OAI-SearchBot | OpenAI | ChatGPT search results | a robots change takes about 24 h; IPs published by OpenAI |
| ChatGPT-User | OpenAI | fetches a page a user asked about | robots.txt may not apply |
| Claude-SearchBot | Anthropic | Claude's search index | blocking reduces visibility in Claude answers |
| Claude-User | Anthropic | fetches a page a user asked about | |
| PerplexityBot | Perplexity | Perplexity search index | not used for training |
| Perplexity-User | Perplexity | fetches a page a user asked about | generally ignores robots.txt |
| Applebot, DuckDuckBot, SeznamBot, YandexBot, DuckAssistBot, MistralAI-User, Amzn-SearchBot | others | search and assistants | listed in `ALLOWED_BOTS` |

### Training (owner policy: allowed)

| Token | Effect of a Disallow |
|---|---|
| GPTBot | out of OpenAI model training; no effect on ChatGPT search |
| ClaudeBot | out of Anthropic training; honours Crawl-delay |
| Google-Extended | out of Gemini training and grounding; no effect on Google Search (a control token, no own crawler) |
| Applebot-Extended | out of Apple model training (control token) |
| CCBot | out of Common Crawl, a widely used training corpus |
| Amazonbot, Meta-ExternalAgent | out of Amazon / Meta AI use |

Why allowed: the Atlas is an open-access non-profit; models that have read it are more likely
to know and name it (ADR-021).

Verify a bot by its operator's published IP list, not by the user-agent string alone.

## What non-JS crawlers see

| Crawler | Runs JS |
|---|---|
| Googlebot (and Gemini via Google's index), Applebot | yes |
| GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, CCBot | no |

Quick check of what a non-JS bot gets:

```sh
curl -s -A "OAI-SearchBot" https://atlas-of-todays-world.vercel.app/country/china \
  | sed -e 's/<script[^>]*>.*<\/script>//g' -e 's/<[^>]*>/ /g' | tr -s ' \n' | wc -c
curl -s -A "GPTBot" https://atlas-of-todays-world.vercel.app/country/china | grep -c '<link rel="canonical"'
```

The second line must print 1: metadata is in `<head>` (a prerendered page). On a dynamic route
without `htmlLimitedBots` it would be streamed into `<body>` for this user agent.

Next 16 default `htmlLimitedBots` pattern (from `node_modules/next/dist/shared/lib/router/utils/html-bots.js`
in 16.4.0) includes `-Google`/`Google-` crawlers, Chrome-Lighthouse, Slurp, DuckDuckBot,
baiduspider, yandex, Bingbot, applebot, facebookexternalhit, Twitterbot, LinkedInBot, Slackbot,
Discordbot, WhatsApp and a few more. Re-read the file after a Next upgrade.

## llms.txt anatomy (as generated)

```
# Atlas of Today's World
> One-sentence summary of the organization and the site.
Publisher, licence of use, how data is sourced, "Cite as" format, language, links to
llms-full.txt, feeds and sitemap.
## Encyclopedia dossiers
- [Title](https://…/topics/slug): YYYY-MM-DD — first sentences…
## News and analysis · ## World regions · ## Global issues
## Data layers (datasets by country) · ## About the Atlas
## Optional
- [Name](url): note
```

Live: [llms.txt](https://atlas-of-todays-world.vercel.app/llms.txt) (about 44 KB),
[llms-full.txt](https://atlas-of-todays-world.vercel.app/llms-full.txt) (about 800 KB),
example twin [types-of-migrants.md](https://atlas-of-todays-world.vercel.app/topics/types-of-migrants.md).

## Evidence behind the writing rules

GEO study (Aggarwal et al., KDD 2024) on its GEO-bench, measured by position-adjusted word count
in generative answers:
- adding quotations from relevant sources: about +40 %
- adding statistics: about +30 %
- citing sources: about +28 %
- fluency rewrites helped; keyword stuffing scored below baseline
- gains were largest for lower-ranked sources (rank-5 sources gained about +100 %)
- by domain: citing sources helped most for law and government and for facts; quotations for
  history and people and society; statistics for law and government and for debate.
Results were confirmed on Perplexity.

Google (May 2025): unique, non-commodity content, important content in text, structured data
that matches visible text, good images, good page experience. No special AI files or markup.

Microsoft (October 2025): assistants split pages into passages. Clear H2/H3 sections, direct
one-to-two-sentence answers, self-contained sentences, lists and tables for comparisons,
measurable facts; nothing key hidden in tabs, PDFs or images.

## "In short" pattern

Good (template): "As of <year>, <country> <verb> <number + unit> <what>, according to
<named source, linked>. <One sentence of context that is true on its own.>"

Weak: "This page explains the situation in the country and its many challenges."

Shape: entity + time + fact with number + named source; second sentence gives context; no
pronoun openers; no claims the page body doesn't support.

## Measuring

- [Search Console Performance](https://search.google.com/search-console/performance/search-analytics?resource_id=https%3A%2F%2Fatlas-of-todays-world.vercel.app%2F):
  AI Overviews and AI Mode are counted under "Web".
- [Bing Webmaster Tools](https://www.bing.com/webmasters/home?siteUrl=https%3A%2F%2Fatlas-of-todays-world.vercel.app%2F):
  AI Performance report (public preview since February 2026) shows Copilot and Bing AI citations
  per page.
- Vercel Analytics (cookie-less, `@vercel/analytics` in `src/app/layout.tsx`): referrers
  `chatgpt.com`, `perplexity.ai`, `claude.ai`, `copilot.microsoft.com`. Open it from the
  [Vercel team](https://vercel.com/atlas-of-today-s-world) → project → Analytics.
- Vercel logs (project → Logs): filter by user agent (OAI-SearchBot, ChatGPT-User, Claude-User,
  PerplexityBot, Perplexity-User) to see retrieval traffic.

## Sources

- GEO paper: https://arxiv.org/abs/2311.09735 (full text https://arxiv.org/html/2311.09735v3)
- Google, AI features and your website: https://developers.google.com/search/docs/appearance/ai-features
- Google, succeeding in AI search (May 2025): https://developers.google.com/search/blog/2025/05/succeeding-in-ai-search
- Microsoft, optimizing content for AI search answers: https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers
- Google common crawlers and Google-Extended: https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers
- OpenAI bots: https://developers.openai.com/api/docs/bots
- Anthropic crawlers: https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler
- Perplexity bots: https://docs.perplexity.ai/guides/bots
- Common Crawl CCBot: https://commoncrawl.org/ccbot
- Vercel, the rise of the AI crawler: https://vercel.com/blog/the-rise-of-the-ai-crawler
- llms.txt proposal: https://llmstxt.org/
- Bing, sitemaps in AI-powered search: https://blogs.bing.com/webmaster/July-2025/Keeping-Content-Discoverable-with-Sitemaps-in-AI-Powered-Search
- Bing AI Performance report (secondary): https://searchengineland.com/bing-webmaster-tools-testing-new-ai-performance-report-468039
- schema.org Place and Country: https://schema.org/Place, https://schema.org/Country, https://schema.org/about
- Google, supported meta tags (geo tags ignored): https://developers.google.com/search/docs/crawling-indexing/special-tags
- Next.js 16.4 docs: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`
  (Streaming metadata), `…/05-config/01-next-config-js/htmlLimitedBots.md`
