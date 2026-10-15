import { z } from "zod";
import { FEATURED_MAX, RESOURCE_KINDS } from "./constants";
import { CONTENT_STATUSES } from "@/features/geography/content-status";
import { GROUP_KINDS, PLACE_KINDS, type PlaceKind } from "@/features/geography/kinds";
import {
  blankToUndefined,
  hexColor,
  httpsUrl,
  iso3,
  optionalHttpsUrl,
  optionalNumber,
  requiredText,
  slug,
  text,
} from "@/lib/validation/common";

/**
 * Portrait sections as lists of items. Shapes and limits match the tables
 * (faq_items, resources, portrait_metrics); the DB function
 * `replace_portrait_items` saves them in one transaction. The timeline
 * (features/timelines) and the maps & charts (features/visuals) have their
 * own editors and saves.
 */

const optionalText = (max: number) => z.preprocess(blankToUndefined, text(max).optional());

export const COLLECTIONS = {
  faq: z.object({
    question: requiredText(300),
    answer: requiredText(3000),
  }),
  resources: z.object({
    kind: z.enum(RESOURCE_KINDS),
    title: requiredText(200),
    source: text(120).default(""),
    description: text(600).default(""),
    url: httpsUrl,
    image_url: optionalHttpsUrl,
  }),
  // A card without a citation isn't published (P1) — the source is required.
  metrics: z.object({
    value: requiredText(30),
    label: requiredText(80),
    description: text(600).default(""),
    source: requiredText(200),
    source_url: optionalHttpsUrl,
    period: optionalText(20),
  }),
} as const;

export type Collection = keyof typeof COLLECTIONS;
export const COLLECTION_NAMES = Object.keys(COLLECTIONS) as Collection[];

export const PortraitKind = z.enum(PLACE_KINDS);
export type PortraitKind = PlaceKind;

/** Where the globe turns when the place opens — the ranges of the DB CHECKs. */
const MAP_VIEW = {
  center_lon: z.coerce.number().min(-180).max(180),
  center_lat: z.coerce.number().min(-90).max(90),
  zoom: z.coerce.number().min(0.5).max(9),
};

/** Region portrait header (regions table). Regions themselves come from the import. */
export const RegionInput = z.object({
  slug: slug(120),
  name: requiredText(120),
  tagline: text(200),
  summary: text(1000),
  intro: text(5000),
  hero_url: optionalHttpsUrl,
  hero_credit: text(300),
  fill: hexColor,
  stroke: hexColor,
  ...MAP_VIEW,
  // Left out by a form without the field: the stored status stays as it is.
  content_status: z.enum(CONTENT_STATUSES).optional(),
});

/** Global issue (special_regions + its countries). */
export const IssueInput = z.object({
  original_slug: z.preprocess(blankToUndefined, slug(120).optional()),
  // Global issue, or a custom region made of countries (special_regions.kind).
  kind: z.enum(GROUP_KINDS).default("issue"),
  slug: slug(120),
  name: requiredText(120),
  subtitle: text(200),
  summary: text(1000),
  intro: text(5000),
  hero_url: optionalHttpsUrl,
  hero_credit: text(300),
  fill: hexColor,
  stroke: hexColor,
  ...MAP_VIEW,
  // Left out by a form without the field: the stored status stays as it is.
  content_status: z.enum(CONTENT_STATUSES).optional(),
  countries: z.array(iso3).max(250),
});

/**
 * Longest country profile the DB takes (`countries.profile_html`). The action
 * checks it again after sanitizing, which can lengthen the HTML (rel on links).
 */
export const PROFILE_HTML_MAX = 200_000;
export const PROFILE_TOO_LONG = "The text is too long.";

/**
 * The card's indicators in the order the editor put them; the form posts them
 * as a repeated field in that order.
 */
export const FeaturedIndicators = z
  .array(slug(60))
  .max(FEATURED_MAX, `At most ${FEATURED_MAX} indicators — the card shows no more.`)
  .refine((ids) => new Set(ids).size === ids.length, "Each indicator only once.");

/**
 * Editorial country profile and the country's facts. Name, formal name,
 * population, UN subregion and status note come from the import first and are
 * corrected here; the map position and outline (lon, lat, bbox) stay import-only.
 */
export const CountryInput = z.object({
  iso3,
  name: requiredText(120),
  name_formal: optionalText(200),
  population: optionalNumber(
    z.number().int("A whole number.").min(0).max(20_000_000_000, "That is more than the world."),
  ),
  un_subregion: optionalText(60),
  territory_note: optionalText(1000),
  blurb: text(1000),
  tagline: text(300),
  profile_html: z.string().max(PROFILE_HTML_MAX, PROFILE_TOO_LONG),
  featured_indicators: FeaturedIndicators,
  region_slug: z.preprocess(blankToUndefined, slug(120).optional()),
});
