/**
 * Mapování kolekcí Webflow CMS na model Atlasu (PLAN G7, brief P16).
 *
 * ⚠ Názvy souborů a polí jsou ODHAD podle stávajícího webu — export z Webflow
 * zatím nemáme. Až přijde, spusť importér nanečisto (bez --apply): vypíše,
 * které soubory chybí a která pole jsou prázdná, a podle toho uprav `file`
 * a klíče v `fields` níž. Klíče polí jsou ve tvaru slugu: sloupec „Main Image"
 * z CSV i pole `main-image` z API jsou obojí `fields["main-image"]`.
 *
 * Každá kolekce:
 *   name     — jméno pro výpis a přesměrování
 *   file     — soubor v adresáři exportu (`.csv` z CMS Export, nebo `.json` z API v2)
 *   target   — kam se ukládá:
 *              { type: "portrait", kind: "region" | "issue" | "country", slug, collection }
 *                (collection: timeline | faq | resources | visuals | metrics — nahradí se celá)
 *              { type: "entries" }                     (upsert podle slugu)
 *              { type: "region", slug }                (hlavička portrétu regionu)
 *   map      — (item, h) => řádek | řádky | null;  `h` = pomocníci z core.mjs
 *   oldPath / newPath — volitelně vzor staré a nové adresy pro přesměrování ({slug})
 */

const MENA = { type: "portrait", kind: "region", slug: "middle-east-north-africa" };
const UKRAINE = { type: "portrait", kind: "issue", slug: "russia-ukraine-war" };

/** Zdroj (dokument, kniha, databáze) — stejné pole pro MENA i Ukrajinu. */
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

/** Kategorie zdrojů z Webflow → pět kategorií Atlasu. */
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

/** Videa z YouTube (40 vložení na webu) → zdroje „Videos & Documentaries". */
const videos = (item, h) =>
  h
    .youtubeIds(
      [item.fields.video, item.fields["video-link"], item.fields.embed].map(h.text).join(" "),
    )
    .map((id) => h.youtubeResource(id, item.name));

const config = {
  collections: [
    // --- MENA (34 seznamů, 148 položek) ------------------------------------
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
      // Bez citace se karta nepublikuje (P1) — položka bez zdroje se přeskočí.
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

    // --- A Decade of War in Ukraine → první global issue (P8) -------------
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

    // --- Rusko (16 seznamů, 73 položek) → redakční karty země ------------
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

    // --- Global Issues (6 seznamů, 56 položek) → plánovaná témata --------
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
   * Stránky starého webu (všech 7 z briefu P16, ověřeno na www.atlasoftodaysworld.org
   * 2026-10-01; stránky položek CMS starý web nemá). Úvod „/" zůstává.
   * Global Issues nemá v Atlasu vlastní seznam — vede na globus.
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

/** Kategorie z Webflow → pět kategorií Atlasu (CHECK v entries.category). */
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
