import { DEFAULT_LOCALE, localePath, type Locale } from "@/features/i18n/config";
import { ORGANIZATION } from "@/config/organization";
import wikidataCountries from "@/config/wikidata-countries.json";
import { absoluteUrl } from "./index";

/**
 * Structured data (schema.org JSON-LD) — the single builder for every public
 * page (ARCHITEKTURA 13.4). A page renders one `@graph`; nodes point to each
 * other by `@id` (the publisher, the website, places), so search engines and
 * answer engines see one connected set of entities instead of loose blocks.
 * Validated by `jsonld-rules.ts` in unit and e2e tests.
 */

type Value = string | number | boolean | null | undefined | Value[] | { [key: string]: Value };
export type JsonLdNode = { "@type": string | string[] } & { [key: string]: Value };
export interface JsonLdGraph {
  "@context": "https://schema.org";
  "@graph": JsonLdNode[];
}

/** Stable identifiers of the shared entities. */
export const ids = {
  organization: absoluteUrl("/#organization"),
  website: absoluteUrl("/#website"),
  logo: absoluteUrl("/#logo"),
  page: (url: string) => `${url}#webpage`,
  country: (slug: string) => absoluteUrl(`/country/${slug}#place`),
  region: (slug: string) => absoluteUrl(`/region/${slug}#place`),
  issue: (slug: string) => absoluteUrl(`/global-issue/${slug}#place`),
  author: (slug: string) => absoluteUrl(`/authors/${slug}#person`),
};

const ref = (id: string) => ({ "@id": id });

/** Drops empty values so the output carries only what is known. */
function prune(value: Value): Value {
  if (Array.isArray(value)) {
    const items = value.map(prune).filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, prune(item)] as const)
      .filter(([, item]) => item !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  if (value === null || value === "") return undefined;
  return value;
}

/** One `@graph` for the page; false/undefined nodes are skipped. */
export function graph(...nodes: (JsonLdNode | JsonLdNode[] | false | undefined)[]): JsonLdGraph {
  const list = nodes
    .flat()
    .filter((node): node is JsonLdNode => Boolean(node))
    .flatMap(hoistBreadcrumb);
  return { "@context": "https://schema.org", "@graph": list.map((n) => prune(n) as JsonLdNode) };
}

/**
 * A page's breadcrumbs become their own top-level node referenced by `@id`
 * (Google's tools and most parsers look for BreadcrumbList at the top level).
 */
function hoistBreadcrumb(node: JsonLdNode): JsonLdNode[] {
  const crumbs = node.breadcrumb as JsonLdNode | undefined;
  if (!crumbs || typeof node["@id"] !== "string" || crumbs["@type"] !== "BreadcrumbList") {
    return [node];
  }
  const id = node["@id"].replace(/#webpage$/, "#breadcrumb");
  return [
    { ...node, breadcrumb: ref(id) },
    { ...crumbs, "@id": id },
  ];
}

/** Absolute URL of a public page in a language (`/cs/...`). */
export const pageUrl = (path: string, locale: Locale = DEFAULT_LOCALE) =>
  absoluteUrl(localePath(locale, path));

// ---------------------------------------------------------------------------
// Publisher and website
// ---------------------------------------------------------------------------

/** The publisher: a non-profit (NGO) with its registration, contact and profiles. */
export function organizationNode(): JsonLdNode {
  const org = ORGANIZATION;
  return {
    "@type": "NGO",
    "@id": ids.organization,
    name: org.name,
    alternateName: [...org.alternateName],
    legalName: org.legalName,
    url: absoluteUrl("/"),
    logo: {
      "@type": "ImageObject",
      "@id": ids.logo,
      url: absoluteUrl(org.logoPath),
      contentUrl: absoluteUrl(org.logoPath),
      width: org.logoSize,
      height: org.logoSize,
      caption: org.name,
    },
    image: ref(ids.logo),
    description: org.description,
    email: org.email,
    foundingDate: org.foundingDate,
    identifier: { "@type": "PropertyValue", propertyID: "CZ-ICO", value: org.companyId },
    address: { "@type": "PostalAddress", ...org.address },
    areaServed: "Worldwide",
    knowsLanguage: ["en", "cs"],
    sameAs: [...org.socials, org.wikidata],
    publishingPrinciples: absoluteUrl("/about#editorial-standards"),
    potentialAction: {
      "@type": "DonateAction",
      name: "Become an Atlas Patron",
      target: absoluteUrl("/membership"),
      recipient: ref(ids.organization),
    },
  };
}

/** The website with its search (still read by Bing and answer engines). */
export function websiteNode(locale: Locale): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": ids.website,
    name: ORGANIZATION.name,
    alternateName: "Atlas",
    url: absoluteUrl("/"),
    inLanguage: ["en", "cs"],
    publisher: ref(ids.organization),
    isAccessibleForFree: true,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${pageUrl("/search", locale)}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

// ---------------------------------------------------------------------------
// Page and navigation
// ---------------------------------------------------------------------------

export interface Crumb {
  name: string;
  path: string;
}

/** Breadcrumbs (Google shows them instead of the URL); paths in the page language. */
export function breadcrumbNode(crumbs: Crumb[], locale: Locale = DEFAULT_LOCALE): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: pageUrl(crumb.path, locale),
    })),
  };
}

type PageType =
  "WebPage" | "CollectionPage" | "AboutPage" | "ProfilePage" | "ItemPage" | "SearchResultsPage";

/** The page itself: what it is about, in which language, part of which website. */
export function webPageNode(input: {
  url: string;
  name: string;
  description?: string;
  locale: Locale;
  type?: PageType;
  /** `@id` of the main entity (article, place, dataset, person). */
  about?: string;
  image?: string | null;
  modified?: string;
  /** CSS selectors of the parts a voice assistant may read aloud (answer-first summary). */
  speakable?: string[];
  breadcrumb?: JsonLdNode;
}): JsonLdNode {
  return {
    "@type": input.type ?? "WebPage",
    "@id": ids.page(input.url),
    url: input.url,
    name: input.name,
    description: input.description,
    inLanguage: input.locale,
    isPartOf: ref(ids.website),
    publisher: ref(ids.organization),
    primaryImageOfPage: input.image ? absoluteUrl(input.image) : undefined,
    dateModified: input.modified,
    mainEntity: input.about ? ref(input.about) : undefined,
    breadcrumb: input.breadcrumb,
    speakable: input.speakable?.length
      ? { "@type": "SpeakableSpecification", cssSelector: input.speakable }
      : undefined,
  };
}

/** List page (news, an author's articles): ItemList of links in order. */
export function itemListNode(name: string, items: { name: string; url: string }[]): JsonLdNode {
  return {
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

// ---------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------

/** ISO3 → [Wikidata QID, English Wikipedia title] (generated once from Wikidata P298). */
const WIKIDATA: Record<string, string[] | undefined> = wikidataCountries;

/** Wikidata and English Wikipedia of a country (ISO 3166-1 alpha-3), for entity linking. */
export function countrySameAs(iso3: string): string[] {
  const [qid, wiki] = WIKIDATA[iso3] ?? [];
  if (!qid) return [];
  return [
    `https://www.wikidata.org/wiki/${qid}`,
    ...(wiki ? [`https://en.wikipedia.org/wiki/${encodeURIComponent(wiki)}`] : []),
  ];
}

/** Short reference to a country (in `about`, `containsPlace`). */
function countryRef(country: { slug: string; name: string; iso3: string }) {
  return {
    "@type": "Country",
    "@id": ids.country(country.slug),
    name: country.name,
    url: absoluteUrl(`/country/${country.slug}`),
    sameAs: countrySameAs(country.iso3),
  };
}

const coordinates = (lat: number | null | undefined, lon: number | null | undefined) =>
  lat == null || lon == null
    ? undefined
    : {
        "@type": "GeoCoordinates",
        latitude: Number(lat.toFixed(4)),
        longitude: Number(lon.toFixed(4)),
      };

/** A country with codes, position, region, Wikidata and its indicators with sources. */
export function countryNode(input: {
  slug: string;
  iso3: string;
  iso2: string | null;
  name: string;
  nameFormal: string | null;
  description: string;
  lat: number | null;
  lon: number | null;
  locale: Locale;
  region?: { slug: string; name: string } | null;
  population?: number | null;
  stats: {
    label: string;
    raw: number;
    value: string;
    year: number;
    source: string;
    sourceUrl: string;
  }[];
}): JsonLdNode {
  return {
    ...countryRef(input),
    alternateName: input.nameFormal ?? undefined,
    description: input.description,
    url: pageUrl(`/country/${input.slug}`, input.locale),
    identifier: [
      { "@type": "PropertyValue", propertyID: "ISO 3166-1 alpha-3", value: input.iso3 },
      ...(input.iso2
        ? [{ "@type": "PropertyValue", propertyID: "ISO 3166-1 alpha-2", value: input.iso2 }]
        : []),
    ],
    geo: coordinates(input.lat, input.lon),
    hasMap: pageUrl(`/country/${input.slug}`, input.locale),
    containedInPlace: input.region
      ? {
          "@type": "Place",
          "@id": ids.region(input.region.slug),
          name: input.region.name,
          url: absoluteUrl(`/region/${input.region.slug}`),
        }
      : undefined,
    // Indicators as machine-readable values with their source and year.
    additionalProperty: [
      ...(input.population
        ? [{ "@type": "PropertyValue", name: "Population", value: input.population }]
        : []),
      ...input.stats.map((stat) => ({
        "@type": "PropertyValue",
        name: stat.label,
        value: stat.raw,
        unitText: stat.value.replace(/^[\d.,\s]+/, "").trim() || undefined,
        valueReference: `${stat.source} (${stat.year})`,
        url: stat.sourceUrl,
      })),
    ],
  };
}

/** A world region or a global issue (a group of whole countries). */
export function groupPlaceNode(input: {
  kind: "region" | "issue";
  slug: string;
  name: string;
  alternateName?: string;
  description: string;
  locale: Locale;
  center: [number, number];
  image?: string | null;
  countries: { slug: string; name: string; iso3: string }[];
}): JsonLdNode {
  const path = input.kind === "region" ? `/region/${input.slug}` : `/global-issue/${input.slug}`;
  return {
    "@type": "Place",
    "@id": input.kind === "region" ? ids.region(input.slug) : ids.issue(input.slug),
    name: input.name,
    alternateName: input.alternateName,
    description: input.description,
    url: pageUrl(path, input.locale),
    image: input.image ?? undefined,
    hasMap: pageUrl(path, input.locale),
    geo: coordinates(input.center[1], input.center[0]),
    containsPlace: input.countries.map(countryRef),
  };
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

export interface AuthorInfo {
  name: string;
  /** Public profile slug (/authors/<slug>); without it the byline has no page. */
  slug?: string;
  description?: string;
  image?: string;
}

/** Author as a Person with a profile page, or the editorial team as the organization. */
function authorRef(author: AuthorInfo | null | undefined) {
  if (!author || !author.slug) {
    return author && !/editorial|redakce|team/i.test(author.name)
      ? { "@type": "Person", name: author.name, url: absoluteUrl("/about") }
      : ref(ids.organization);
  }
  return {
    "@type": "Person",
    "@id": ids.author(author.slug),
    name: author.name,
    url: absoluteUrl(`/authors/${author.slug}`),
    description: author.description || undefined,
    image: author.image,
  };
}

/** News item (NewsArticle) or encyclopedia entry (Article) with places, sources and parts. */
export function articleNode(input: {
  kind: "news" | "entry";
  url: string;
  headline: string;
  description: string;
  /** Self-contained answer for answer engines (GEO summary), else the key points. */
  abstract?: string;
  images: (string | null | undefined)[];
  published?: string;
  modified?: string;
  locale: Locale;
  author?: AuthorInfo | null;
  section?: string;
  keywords?: string[];
  wordCount?: number;
  about?: { slug: string; name: string; iso3: string }[];
  location?: { slug: string; name: string; center: [number, number] } | null;
  /** Sources the article cites (resources of the dossier). */
  citations?: { title: string; url: string; source?: string }[];
  parts?: { name: string; url: string; audio?: string }[];
  /** Original when this is a translation. */
  translationOf?: string;
}): JsonLdNode {
  const images = input.images.filter((image): image is string => Boolean(image));
  return {
    "@type": input.kind === "news" ? "NewsArticle" : "Article",
    "@id": `${input.url}#article`,
    headline: input.headline.slice(0, 110),
    description: input.description,
    abstract: input.abstract,
    image: images.map((image) => absoluteUrl(image)),
    datePublished: input.published,
    dateModified: input.modified ?? input.published,
    inLanguage: input.locale,
    isAccessibleForFree: true,
    author: authorRef(input.author),
    publisher: ref(ids.organization),
    mainEntityOfPage: ref(ids.page(input.url)),
    url: input.url,
    articleSection: input.section,
    keywords: input.keywords?.length ? input.keywords.join(", ") : undefined,
    wordCount: input.wordCount,
    about: input.about?.map(countryRef),
    contentLocation: input.location
      ? {
          "@type": "Place",
          "@id": ids.region(input.location.slug),
          name: input.location.name,
          url: absoluteUrl(`/region/${input.location.slug}`),
          geo: coordinates(input.location.center[1], input.location.center[0]),
        }
      : undefined,
    citation: input.citations?.map((item) => ({
      "@type": "CreativeWork",
      name: item.title,
      url: item.url,
      publisher: item.source ? { "@type": "Organization", name: item.source } : undefined,
    })),
    hasPart: input.parts?.map((part) => ({
      "@type": "WebPageElement",
      name: part.name,
      url: part.url,
      audio: part.audio
        ? { "@type": "AudioObject", contentUrl: part.audio, name: part.name }
        : undefined,
    })),
    translationOfWork: input.translationOf ? ref(`${input.translationOf}#article`) : undefined,
    copyrightHolder: ref(ids.organization),
  };
}

/** Questions and answers shown on the page (still read by Bing and answer engines). */
export function faqNode(url: string, items: { question: string; answer: string }[]) {
  if (!items.length) return undefined;
  return {
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  } satisfies JsonLdNode;
}

/** Author profile (ProfilePage → Person). */
export function personNode(input: {
  slug: string;
  name: string;
  description?: string;
  image?: string;
  knowsAbout?: string[];
}): JsonLdNode {
  return {
    "@type": "Person",
    "@id": ids.author(input.slug),
    name: input.name,
    url: absoluteUrl(`/authors/${input.slug}`),
    description: input.description || undefined,
    image: input.image,
    knowsAbout: input.knowsAbout,
    affiliation: ref(ids.organization),
  };
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

/** One data layer as a Dataset: what is measured, where, when, from whom, under what licence. */
export function datasetNode(input: {
  id: string;
  name: string;
  description: string;
  locale: Locale;
  unit?: string;
  latestYear: number | null;
  earliestYear?: number | null;
  source: string;
  sourceUrl: string;
  modified?: string;
}): JsonLdNode {
  const url = pageUrl(`/view/${input.id}`, input.locale);
  const years =
    input.earliestYear && input.latestYear && input.earliestYear !== input.latestYear
      ? `${input.earliestYear}/${input.latestYear}`
      : input.latestYear
        ? String(input.latestYear)
        : undefined;
  return {
    "@type": "Dataset",
    "@id": `${url}#dataset`,
    name: `${input.name} by country`,
    // Google wants 50–5000 characters; a short label gets its coverage sentence.
    description:
      input.description.length >= 50
        ? input.description
        : `${input.description} Latest available value per country, from ${input.source}.`,
    url,
    identifier: input.id,
    keywords: [input.name, "country data", "world map", input.source],
    inLanguage: input.locale,
    creator: { "@type": "Organization", name: input.source, url: input.sourceUrl },
    publisher: ref(ids.organization),
    includedInDataCatalog: {
      "@type": "DataCatalog",
      name: `${ORGANIZATION.name} data layers`,
      url: absoluteUrl("/about#data"),
    },
    isBasedOn: input.sourceUrl,
    citation: `${input.source}. ${input.name}. ${input.sourceUrl}`,
    temporalCoverage: years,
    spatialCoverage: { "@type": "Place", name: "World" },
    variableMeasured: {
      "@type": "PropertyValue",
      name: input.name,
      unitText: input.unit?.trim() || undefined,
    },
    measurementTechnique: `Latest available value per country from ${input.source}`,
    dateModified: input.modified,
    license: "https://creativecommons.org/licenses/by/4.0/",
    isAccessibleForFree: true,
  };
}
