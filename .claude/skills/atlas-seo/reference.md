# SEO reference

Detail for [atlas-seo](SKILL.md). Paths are relative to the repository root.

## Page kinds

Which metadata and which JSON-LD each kind of public page uses. Every page also gets the
site-wide graph from `src/app/[locale]/layout.tsx`: `organizationNode` (NGO with IČO, Wikidata
`sameAs`, address), `websiteNode` and `builderNode`.

| Page | Route | `og:type` | JSON-LD (builders in `src/features/seo/jsonld.ts`) |
|---|---|---|---|
| Home | `/` | website | `webPageNode` type CollectionPage; Dataset by `@id` reference (see gap 7) |
| Topic | `/topics/[slug]` | article | `webPageNode` + `breadcrumbNode`, `articleNode` kind `entry` (Article), `faqNode` if FAQ visible |
| News item | `/news/[slug]` | article | `webPageNode` + `breadcrumbNode`, `articleNode` kind `news` (NewsArticle) |
| Country | `/country/[slug]` | website | `webPageNode` type ItemPage, `countryNode` (Country) |
| Region | `/region/[slug]` | website | `groupPlaceNode` kind `region` (Place), `faqNode` if visible |
| Global issue | `/global-issue/[slug]` | website | `groupPlaceNode` kind `issue`, `faqNode` if visible |
| Author | `/authors/[slug]` | profile | `webPageNode` type ProfilePage, `personNode` |
| Data view | `/view/[indicator]` | website | `datasetNode` (full Dataset with licence and creator) |
| Indexes | `/topics`, `/news`, `/countries`, `/global-issues` | website | `webPageNode` type CollectionPage or `collectionPageGraph`, `itemListNode` |
| About | `/about` | website | `webPageNode` type AboutPage |
| Private | account, sign-in, invite, checkout, preview, admin | none | none (`privateMetadata`) |

Region and issue pages build metadata with `groupMetadata(kind)` in
`src/features/portraits/group-page.tsx`.

## Article JSON-LD fields we fill

`articleNode` sets `headline` (max 110 characters), `description`, `abstract` (the "In short"
GEO summary or the summary points), `image[]`, `datePublished`, `dateModified`, `inLanguage`,
`isAccessibleForFree`, `author`, `publisher` (`/#organization`), `mainEntityOfPage`,
`articleSection`, `keywords`, `wordCount`, `about` (countries with Wikidata `sameAs`),
`contentLocation` (region), `citation[]` (the dossier's resources), `hasPart[]` (subtopics, with
audio), `copyrightHolder`.

Author target shape (after the affiliation field exists):

```json
{
  "@type": "Person",
  "@id": "https://atlas-of-todays-world.vercel.app/authors/jane-doe#person",
  "name": "Jane Doe",
  "url": "https://atlas-of-todays-world.vercel.app/authors/jane-doe",
  "jobTitle": "Researcher",
  "affiliation": { "@type": "Organization", "name": "Example Foundation" }
}
```

Recommended images for Article: several crawlable images, ideally 16:9, 4:3 and 1:1, each at
least 50,000 pixels in area.

## Sitemap files

| File | Content | `lastmod` source (`getSitemaps()` in `src/features/seo/queries.ts`) |
|---|---|---|
| `pages` | home, indexes, about, newsletter, membership, legal | latest of the items each page lists |
| `regions` | regions and global issues, with hero image | `special_regions.updated_at` / `regions.updated_at` (+ data stamp, see gap 1) |
| `countries` | every country | `countries.updated_at` (+ data stamp, see gap 1) |
| `data` | `/view/<indicator>` | `indicators.updated_at` |
| `news`, `entries` | articles, with hero image | `updated` or `published` of the article |
| `authors` | authors with at least one article | latest article date of the author |
| `google-news` | news from the last 2 days | `published` |

Route handlers: `src/app/sitemap.xml/route.ts` (index), `src/app/sitemaps/[file]/route.ts`.
XML builders: `src/lib/seo/xml.ts` (`sitemapIndexXml`, `urlsetXml`, `latest`).
Limits: 50,000 URLs and 50 MB per file; split before reaching them.

## Redirect sources, in order

1. `BUILT_IN_REDIRECTS` (`src/config/redirects.ts`) via `next.config.ts` `redirects()`: old URL
   shapes, the former Czech version, old admin bookmarks. Code change + PR.
2. `src/proxy.ts`: `/en/x` → `/x` and case or trailing-slash variants (308).
3. `redirects` table managed in
   [Admin → Redirects](https://atlas-of-todays-world.vercel.app/admin/redirects), read by
   `redirectOrNotFound()` in the guarded layouts. `permanent` → 308, otherwise 307. The
   `authors_slug_redirect` trigger maintains author renames.

## Tools and deep links

- Google Search Console (Performance, Pages, Sitemaps):
  [property](https://search.google.com/search-console?resource_id=https%3A%2F%2Fatlas-of-todays-world.vercel.app%2F),
  [Sitemaps report](https://search.google.com/search-console/sitemaps?resource_id=https%3A%2F%2Fatlas-of-todays-world.vercel.app%2F).
- Bing Webmaster Tools:
  [site dashboard](https://www.bing.com/webmasters/home?siteUrl=https%3A%2F%2Fatlas-of-todays-world.vercel.app%2F)
  (also IndexNow status and the AI Performance report).
- [Rich Results Test](https://search.google.com/test/rich-results?url=https%3A%2F%2Fatlas-of-todays-world.vercel.app%2Ftopics%2Ftypes-of-migrants),
  [Schema.org validator](https://validator.schema.org/).
- Live files: [robots.txt](https://atlas-of-todays-world.vercel.app/robots.txt),
  [sitemap.xml](https://atlas-of-todays-world.vercel.app/sitemap.xml).
- Env vars (`INDEXNOW_KEY`, `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`,
  `SEZNAM_SITE_VERIFICATION`) are runtime env of the Vercel project in team
  [atlas-of-today-s-world](https://vercel.com/atlas-of-today-s-world) → project → Settings →
  Environment Variables. The IndexNow key is 8–128 characters `a-z A-Z 0-9 -` and is public by design.
- Editor SEO fields per article: [Admin → Content](https://atlas-of-todays-world.vercel.app/admin/content)
  → open the article → SEO (title, description, keywords, "In short (GEO)", share image, noindex).
- Site-wide SEO title, description and share image:
  [Admin → Site settings](https://atlas-of-todays-world.vercel.app/admin/site).

## Quick manual checks

```sh
curl -sI https://atlas-of-todays-world.vercel.app/country/China       # 308 to lowercase
curl -s  https://atlas-of-todays-world.vercel.app/country/china | grep -o '<link rel="canonical"[^>]*>'
curl -s  https://atlas-of-todays-world.vercel.app/sitemaps/countries.xml | grep -o '<lastmod>[^<]*' | sort | uniq -c | sort -rn | head
curl -s -o /dev/null -w "%{http_code}\n" https://atlas-of-todays-world.vercel.app/country/not-a-country   # 404
```

The `uniq -c` line shows whether many URLs share one `lastmod` (a sign of bulk or generated dates).

## Sources

- Google, JavaScript SEO basics: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- Google, SEO starter guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Google, canonical URLs: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Google, localized versions (hreflang): https://developers.google.com/search/docs/specialty/international/localized-versions
- Google, title links: https://developers.google.com/search/docs/appearance/title-link
- Google, snippets: https://developers.google.com/search/docs/appearance/snippet
- Google, supported meta tags: https://developers.google.com/search/docs/crawling-indexing/special-tags
- Google, AI features and preview controls: https://developers.google.com/search/docs/appearance/ai-features
- Open Graph types: https://ogp.me/#types
- Google, build a sitemap (lastmod): https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Google, news sitemap: https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
- Google, image sitemap: https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps
- Bing, sitemaps and lastmod in AI search (2025): https://blogs.bing.com/webmaster/July-2025/Keeping-Content-Discoverable-with-Sitemaps-in-AI-Powered-Search
- IndexNow documentation: https://www.indexnow.org/documentation
- Google, structured data policies: https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- Google, structured data gallery: https://developers.google.com/search/docs/appearance/structured-data/search-gallery
- Google, Article: https://developers.google.com/search/docs/appearance/structured-data/article
- Google, Breadcrumb: https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
- Google, Organization: https://developers.google.com/search/docs/appearance/structured-data/organization
- Google, ProfilePage: https://developers.google.com/search/docs/appearance/structured-data/profile-page
- Google, Dataset: https://developers.google.com/search/docs/appearance/structured-data/dataset
- Google, Speakable (beta): https://developers.google.com/search/docs/appearance/structured-data/speakable
- Google, helpful content: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Google, spam policies: https://developers.google.com/search/docs/essentials/spam-policies
- Google, image SEO: https://developers.google.com/search/docs/appearance/google-images
