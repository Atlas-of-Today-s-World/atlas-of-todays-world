/**
 * Mapping of Webflow CMS collections onto the Atlas model (PLAN G7, brief P16).
 *
 * ⚠ File and field names are a GUESS based on the current site — we do not have
 * the Webflow export yet. When it arrives, run the importer as a dry run (without
 * --apply): it lists which files are missing and which fields are empty; adjust
 * `file` and the keys in `fields` below accordingly. Field keys are slug-shaped:
 * the CSV column "Main Image" and the API field `main-image` are both `fields["main-image"]`.
 *
 * Each collection:
 *   name     — name for output and redirects
 *   file     — file in the export directory (`.csv` from CMS Export, or `.json` from API v2)
 *   target   — where it is stored:
 *              { type: "portrait", kind: "region" | "issue" | "country", slug, collection }
 *                (collection: timeline | faq | resources | visuals | metrics — replaced whole)
 *              { type: "entries" }                     (upsert by slug)
 *              { type: "region", slug }                (region portrait header)
 *   map      — (item, h) => row | rows | null;  `h` = helpers from core.mjs
 *   oldPath / newPath — optional old and new URL patterns for redirects ({slug})
 */

const MENA = { type: "portrait", kind: "region", slug: "middle-east-north-africa" };
const UKRAINE = { type: "portrait", kind: "issue", slug: "russia-ukraine-war" };

/** Resource (document, book, database) — same fields for MENA and Ukraine. */
const resource = (item, h) => {
  const url = h.text(item.fields.link ?? item.fields.url);
  if (!url.startsWith("https://")) return null;
  return {
    kind: KIND[h.text(item.fields.category)] ?? "Articles, Reports & Books",
    title: h.clip(item.name, 200),
    source: h.clip(item.fields.source ?? item.fields.publisher, 120),
    description: h.clip(h.plain(item.fields.description), 600),
    url,
    image_url: h.text(item.fields.image ?? item.fields.thumbnail) || null,
  };
};

/** Resource categories from Webflow → the five Atlas categories. */
const KIND = {
  Videos: "Videos & Documentaries",
  Documentaries: "Videos & Documentaries",
  "Videos & Documentaries": "Videos & Documentaries",
  Lectures: "Lectures & Debates",
  Debates: "Lectures & Debates",
  "Lectures & Debates": "Lectures & Debates",
  Articles: "Articles, Reports & Books",
  Reports: "Articles, Reports & Books",
  Books: "Articles, Reports & Books",
  "Educational Resources": "Educational Resources",
  Education: "Educational Resources",
  Statistics: "Statistics & Infographics",
  Infographics: "Statistics & Infographics",
  "Statistics & Infographics": "Statistics & Infographics",
};

const timeline = (item, h) => ({
  date_label: h.clip(item.fields.date ?? item.fields.year ?? item.fields["date-label"], 60),
  title: h.clip(item.name, 200),
  body: h.clip(h.plain(item.fields.description ?? item.fields.text), 2000),
  image_url: h.text(item.fields.image) || null,
});

/** YouTube videos (40 embeds on the site) → "Videos & Documentaries" resources. */
const videos = (item, h) =>
  h
    .youtubeIds(
      [item.fields.video, item.fields["video-link"], item.fields.embed].map(h.text).join(" "),
    )
    .map((id) => h.youtubeResource(id, item.name));

const config = {
  collections: [
    // --- MENA (34 lists, 148 items) ----------------------------------------
    {
      name: "mena-intro",
      file: "mena-portrait.csv",
      target: { type: "region", slug: "middle-east-north-africa" },
      map: (item, h) => ({
        summary: h.clip(h.plain(item.fields.summary), 1000),
        intro: h.clip(h.plain(item.fields.intro ?? item.fields.body), 5000),
        hero_url: h.text(item.fields["hero-image"] ?? item.fields.image) || null,
        portrait_status: "populated",
      }),
    },
    {
      name: "mena-timeline",
      file: "mena-timeline.csv",
      target: { ...MENA, collection: "timeline" },
      map: timeline,
    },
    {
      name: "mena-indicators",
      file: "mena-indicators.csv",
      target: { ...MENA, collection: "metrics" },
      // A card without a citation is not published (P1) — items without a source are skipped.
      map: (item, h) =>
        h.text(item.fields.source)
          ? {
              value: h.clip(item.fields.value ?? item.name, 30),
              label: h.clip(item.fields.label ?? item.name, 80),
              description: h.clip(h.plain(item.fields.description), 600),
              source: h.clip(item.fields.source, 200),
              source_url: h.text(item.fields["source-link"]) || null,
              period: h.clip(item.fields.year ?? item.fields.period, 20) || null,
            }
          : null,
    },
    {
      name: "mena-resources",
      file: "mena-resources.csv",
      target: { ...MENA, collection: "resources" },
      map: resource,
    },
    {
      name: "mena-videos",
      file: "mena-videos.csv",
      target: { ...MENA, collection: "resources" },
      map: videos,
    },
    {
      name: "mena-faq",
      file: "mena-faq.csv",
      target: { ...MENA, collection: "faq" },
      map: (item, h) => ({
        question: h.clip(item.fields.question ?? item.name, 300),
        answer: h.clip(h.plain(item.fields.answer), 3000),
      }),
    },

    // --- A Decade of War in Ukraine → the first global issue (P8) ---------
    {
      name: "ukraine-timeline",
      file: "ukraine-timeline.csv",
      target: { ...UKRAINE, collection: "timeline" },
      map: timeline,
    },
    {
      name: "ukraine-resources",
      file: "ukraine-resources.csv",
      target: { ...UKRAINE, collection: "resources" },
      map: resource,
    },
    {
      name: "ukraine-videos",
      file: "ukraine-videos.csv",
      target: { ...UKRAINE, collection: "resources" },
      map: videos,
    },

    // --- Russia (16 lists, 73 items) → editorial country cards -----------
    {
      name: "russia-indicators",
      file: "russia-indicators.csv",
      target: { type: "portrait", kind: "country", slug: "RUS", collection: "metrics" },
      map: (item, h) =>
        h.text(item.fields.source)
          ? {
              value: h.clip(item.fields.value ?? item.name, 30),
              label: h.clip(item.fields.label ?? item.name, 80),
              description: h.clip(h.plain(item.fields.description), 600),
              source: h.clip(item.fields.source, 200),
              source_url: h.text(item.fields["source-link"]) || null,
              period: h.clip(item.fields.year, 20) || null,
            }
          : null,
    },

    // --- Global Issues (6 lists, 56 items) → planned topics --------------
    {
      name: "global-issues-topics",
      file: "global-issues.csv",
      target: { type: "entries" },
      map: (item, h) => ({
        slug: h.slugify(item.slug || item.name),
        kind: "entry",
        status: "planned",
        title: h.clip(item.name, 200),
        summary: h.clip(h.plain(item.fields.summary ?? item.fields.description), 600),
        category: CATEGORY[h.text(item.fields.category)] ?? "Society",
        region_slug: null,
        special_slug: h.text(item.fields["global-issue"])
          ? h.slugify(item.fields["global-issue"])
          : null,
        body_html: "",
        countries: [],
      }),
    },
  ],

  /**
   * Pages of the old site (all 7 from brief P16, verified on www.atlasoftodaysworld.org
   * 2026-10-01; the old site has no CMS item pages). The home page "/" stays.
   * Global Issues has no list of its own in the Atlas — it leads to the globe.
   */
  redirects: [
    { from: "/about-us", to: "/about" },
    { from: "/membership", to: "/patrons" },
    { from: "/middle-east-and-north-africa", to: "/region/middle-east-north-africa" },
    { from: "/russia", to: "/country/russia" },
    { from: "/adecadeofwarinukraine", to: "/global-issue/russia-ukraine-war" },
    { from: "/global-issues", to: "/" },
  ],
};

export default config;

/** Categories from Webflow → the five Atlas categories (CHECK on entries.category). */
const CATEGORY = {
  "Living Conditions": "Living Conditions",
  Economy: "Living Conditions",
  "Political System": "Political System",
  Politics: "Political System",
  Society: "Society",
  "International Relations": "International Relations",
  Conflict: "International Relations",
  "Historical Roots": "Historical Roots",
  History: "Historical Roots",
};
