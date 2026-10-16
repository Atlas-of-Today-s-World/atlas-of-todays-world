# atlas-ux: reference

Longer notes and sources behind the rules in [SKILL.md](SKILL.md). Paraphrased; nothing copied.

## Where each reader flow lives in the code

| Flow | Files |
|---|---|
| Home globe | `src/app/[locale]/(map)/page.tsx`, `src/components/map/AtlasGlobe.tsx`, `MapControls`, `ViewSwitcher`, `IssueMenu`, `FeaturedSubtopics` |
| Panel (country, region, news, data layer) | `src/components/ContentRail.tsx`, `src/components/portrait/Portrait.tsx`, `src/components/CountryCard.tsx`, `src/app/[locale]/(map)/view/[indicator]/page.tsx` |
| Full page (topics, global issues) | `src/components/FullPage.tsx`, `src/features/topics/components/{TopicsBrowser,EncyclopediaArticle,DossierExplorer}.tsx`, `src/features/portraits/components/{IssuesBrowser,IssueArticle}.tsx` |
| Plain list of every place | `src/app/[locale]/(pages)/countries/page.tsx` |
| Loading, error, not found | `loading.tsx` per slug route, `error.tsx` per route group, `not-found.tsx` (with `features/quiz`) |
| Support and volunteers | `src/components/membership/{FloatingActions,DonateCoin,DonationCard}.tsx`, `src/components/topics/{NoTopicsCta,TopicsInvite}.tsx`, `PatronsCallout` in `src/components/portrait/sections.tsx`, `/membership` |
| Scroll memory | `src/lib/use-scroll-memory.ts`, `src/components/RememberedScroll.tsx` |
| URL filters | `src/components/atlas/url-filters.ts` |

## Review questions for a new public screen

1. Which level is it (globe, panel, full page)? Why not one of the existing pages?
2. What does a reader learn in the first screenful? Is that the answer or a preamble?
3. What happens with no data, one item, and 50 items with long names?
4. What can be shared? Does the URL carry it? Does Back return to the same spot?
5. What is the next step at the end of the page and on its error state?
6. Does it work with one thumb on a 320 px phone, with the bottom sheet open?
7. Is any reader-facing string hard-coded instead of coming from `en.json`?

## Patterns borrowed from exemplary sites

- Our World in Data: a key-insights list at the top that doubles as navigation; published and
  updated dates near the title; view state (tab, countries) in the query string.
  https://ourworldindata.org/co2-and-greenhouse-gas-emissions , https://ourworldindata.org/grapher/life-expectancy
- Wikipedia: a short description under the title; collapsible sections on phones.
  https://www.mediawiki.org/wiki/Reading/Web/Desktop_Improvements/Features/Visual_Refinements
- The Pudding: support and newsletter cards set apart from stories; "Load more" instead of
  infinite scroll. https://pudding.cool/
- GOV.UK browse: topic cards as a linked heading plus a one-line description of what is inside.
  https://www.gov.uk/browse/working

## Sources

- NN/g, F-shaped pattern and front-loading: https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/
- NN/g, tables of contents: https://www.nngroup.com/articles/table-of-contents/
- NN/g, breadcrumbs: https://www.nngroup.com/articles/breadcrumbs/
- NN/g, skeleton screens: https://www.nngroup.com/articles/skeleton-screens/
- NN/g, response time limits: https://www.nngroup.com/articles/response-times-3-important-limits/
- NN/g, empty states: https://www.nngroup.com/articles/empty-state-interface-design/
- NN/g, ten usability heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
- Laws of UX (Jakob, Hick, Doherty): https://lawsofux.com/
- Vercel Web Interface Guidelines: https://vercel.com/design/guidelines
- WCAG 2.2, what is new (redundant entry, dragging): https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- GOV.UK clear language: https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/
