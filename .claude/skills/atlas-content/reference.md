# atlas-content — reference

Long detail for [SKILL.md](SKILL.md). Limits come from the Zod schemas and the matching database
CHECKs; when a limit here and the code differ, the code wins — fix this file in the same PR.

## 1. Field limits (characters unless stated)

### Topics and news (`src/features/entries/schema.ts`, `constants.ts`)

| Field | Limit | Notes |
|---|---|---|
| Title | 200 | required |
| Summary | 600 | first sentence defines the subject |
| Summary bullets | 5 × 300 | one per line; topics and subtopics |
| Slug | 120 | `a-z`, `0-9`, single hyphens; locked once published |
| Countries | 60 | ISO3 codes |
| Header photo credit | 300 | `cover_credit` |
| Reading time | 1–180 minutes | optional |
| Body | 400,000 (HTML, after sanitizing) | |
| Subtopics | 12 per topic | `MAX_CHAPTERS` |
| Subtopic body | 200,000 (HTML) | illustration credit 300 |
| Subtopic audio | 50 MB | MP3, M4A/AAC, Ogg/Opus, WAV, FLAC |
| "Learn more" tiles | 24 per topic, 200 links in total | tile label 60, description 200, photo credit 300 |
| Topic FAQ | 20 questions; question 300, answer 2,000 | shown as FAQPage structured data |
| Search title / description | 70 / 170 | SEO & GEO tab (`atlas-seo`) |
| Keywords | 12 × 60 | |
| "In short" summary | 800 | visible block at the top (`atlas-geo`) |
| Topic section labels | 40 | "Subtopics", "Learn more" overrides |

### Portraits (`src/features/portraits/schema.ts`)

| Field | Limit |
|---|---|
| Region: name / tagline / summary / intro | 120 / 200 / 1,000 / 5,000 |
| Global issue: name / subtitle / summary / intro | 120 / 200 / 1,000 / 5,000 |
| Hero credit | 300 |
| Key-fact card: value / label / description / source / period | 30 / 80 / 600 / 200 (required) / 20 |
| Resource: title / publisher / description | 200 / 120 / 600, https link required |
| Portrait FAQ: question / answer | 300 / 3,000 |
| Items per portrait list (cards, resources, FAQ) | 50 |
| Country: name / formal name / tagline / blurb / territory note | 120 / 200 / 300 / 1,000 / 1,000 |
| Country profile body | 200,000 (HTML) |
| Featured indicators on the country card | 6 |

### Timelines (`src/features/timelines/`)

60 events per timeline; event title 200, date 60, rich text 20,000; up to 20 sources per event
(source title 300, https URL). An empty source title becomes the link's host name.

### Site pages and UI texts

- Site pages (`src/features/site-pages/pages.ts`): title 200, description 300, lead 1,000, body
  100,000. Tokens: `{{contact}}`, `{{email}}`, `{{data-sources}}` (About only).
- UI text overrides (`src/features/ui-texts/model.ts`): 2,000 characters; `{placeholders}` must
  match the original; namespaces `auth`, `account`, `invite` are locked; menu labels live in
  Site menus.

### Rich text

Allowed in topic, subtopic, profile and page bodies (`src/lib/security/sanitize.ts`): headings
H2–H4, paragraphs, quotes, lists, bold, italic, links, code, horizontal rule, tables, figures with
captions, images (`src`, `alt`, `title`, `width`, `height`), superscript and subscript. Anything
else is removed on save. Links get `rel="noopener noreferrer"` automatically.

## 2. Source hierarchy

Use the highest tier available for the claim.

1. **Primary statistical sources** for numbers: UN agencies (UNHCR, UNDP, UN DESA), World Bank,
   IMF, OECD, national statistics offices, established research datasets (V-Dem, SIPRI, ACLED).
2. **Reputable secondary sources** for interpretation: peer-reviewed research, university presses,
   major news agencies (Reuters, AP, AFP), think tanks named with their funding stance.
3. **Primary statements** (governments, parties, armed groups, companies): only for what they say,
   attributed ("According to the Ministry of Defence…").
4. **Not acceptable**: social media posts (except as a statement by their verified author),
   anonymous blogs, content farms, AI chatbot answers, Wikipedia itself.

Weigh age (newer data beats older for current figures), independence (who funds the source) and
consensus (one outlier study is not "experts say").

## 3. Credit formats

| Image source | Credit field text |
|---|---|
| Your own photo | `Jane Doe / Atlas of Today's World` |
| Wikimedia Commons, CC BY-SA | `Jane Doe / Wikimedia Commons, CC BY-SA 4.0 (cropped)` |
| Public domain (e.g. NASA) | `NASA (public domain)` |
| Unsplash | `Jane Doe / Unsplash` |
| Agency or partner with permission | `Jane Doe / Agency name, used with permission` |

Pattern (TASL): title if useful, **author**, source, licence, and "(cropped)" / "(colour adjusted)"
when you changed it. ShareAlike licences bind derivatives; NoDerivatives forbids cropping.

## 4. Correction templates (suggested)

- Correction: `Correction (16 October 2026): An earlier version of this article gave the number of
  refugees as 6.9 million. The correct figure is 6.7 million (UNHCR, mid-2025).`
- Update: `Update (16 October 2026): The ceasefire announced on 10 October has since collapsed.`
- Clarification: `Clarification (16 October 2026): This section now states that the figure covers
  registered refugees only.`

Place the note at the end of the article body (or of the affected subtopic) as its own paragraph
in italics. Keep it for the life of the article.

## 5. Review cadence (suggested)

| Content | Re-read |
|---|---|
| Topics on active conflicts, elections, crises | monthly |
| Other topics, region and issue portraits | every 3 months |
| Country profiles and key-fact cards | when the source publishes new data (usually yearly) |
| Site pages (privacy, terms) | when the practice changes; update "Last updated" |

## 6. More sources

- Reuters Trust Principles — https://www.thomsonreuters.com/en/about-us/trust-principles
- Our World in Data topic page pattern (key insights, sources, "as of" dates) — https://ourworldindata.org/co2-and-greenhouse-gas-emissions
- Natural Earth: Disputed boundaries policy — https://www.naturalearthdata.com/about/disputed-boundaries-policy/
- NN/g: Table of contents guidance — https://www.nngroup.com/articles/table-of-contents/
