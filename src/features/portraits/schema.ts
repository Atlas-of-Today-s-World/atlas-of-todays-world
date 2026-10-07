import { z } from "zod";
import { RESOURCE_KINDS, VISUAL_PROVIDERS } from "./constants";
import { datawrapperChartUrl, extractDatawrapperUrl } from "@/lib/embeds";
import {
  blankToUndefined,
  hexColor,
  httpsUrl,
  optionalHttpsUrl,
  requiredText,
  slug,
  text,
} from "@/lib/validation/common";

/**
 * Portrait sections as lists of items. Shapes and limits match the tables
 * (timeline_events, faq_items, resources, visual_embeds, portrait_metrics);
 * the DB function `replace_portrait_items` saves them in one transaction.
 */

const optionalText = (max: number) => z.preprocess(blankToUndefined, text(max).optional());

/**
 * Datawrapper: the editor pastes the embed code or the chart URL. Only the chart
 * URL it contains is kept (lib/embeds.ts) — never the pasted HTML. A paste that
 * is a valid Datawrapper chart switches the type to "datawrapper" on its own, so a
 * forgotten type select can't turn it into a broken image.
 */
function withChartUrl(raw: unknown) {
  if (typeof raw !== "object" || raw === null) return raw;
  const item = raw as Record<string, unknown>;
  const chart = extractDatawrapperUrl(item.url);
  return chart ? { ...item, provider: "datawrapper", url: chart } : item;
}

const DATAWRAPPER_HINT =
  "Paste Datawrapper's responsive iframe embed code or the chart URL (https://datawrapper.dwcdn.net/…/1/).";

const visual = z.preprocess(
  withChartUrl,
  z
    .object({
      provider: z.enum(VISUAL_PROVIDERS),
      title: requiredText(200),
      caption: text(500).default(""),
      // Checked below together with the type: a Datawrapper item gets its own message.
      url: z.string().trim(),
    })
    .superRefine((item, ctx) => {
      const datawrapper = item.provider === "datawrapper";
      const ok = datawrapper
        ? datawrapperChartUrl(item.url) !== null
        : httpsUrl.safeParse(item.url).success;
      if (!ok)
        ctx.addIssue({
          code: "custom",
          path: ["url"],
          message: datawrapper ? DATAWRAPPER_HINT : "The URL must start with https://.",
        });
    }),
);

export const COLLECTIONS = {
  timeline: z.object({
    date_label: requiredText(60),
    title: requiredText(200),
    body: text(2000).default(""),
    image_url: optionalHttpsUrl,
  }),
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
  visuals: visual,
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

export const PortraitKind = z.enum(["region", "issue", "country"]);
export type PortraitKind = z.infer<typeof PortraitKind>;

/** Region portrait header (regions table). */
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
  timeline_title: text(120),
  timeline_subtitle: text(300),
});

/** Global issue (special_regions + its countries). */
export const IssueInput = z.object({
  original_slug: z.preprocess(blankToUndefined, slug(120).optional()),
  // Global issue, or a custom region made of countries (special_regions.kind).
  kind: z.enum(["issue", "region"]).default("issue"),
  slug: slug(120),
  name: requiredText(120),
  subtitle: text(200),
  summary: text(1000),
  intro: text(5000),
  hero_url: optionalHttpsUrl,
  hero_credit: text(300),
  fill: hexColor,
  stroke: hexColor,
  center_lon: z.coerce.number().min(-180).max(180),
  center_lat: z.coerce.number().min(-90).max(90),
  zoom: z.coerce.number().min(0.5).max(9),
  timeline_title: text(120),
  timeline_subtitle: text(300),
  countries: z.array(z.string().regex(/^[A-Z]{3}$/)).max(250),
});

/** Editorial country profile. */
export const CountryInput = z.object({
  iso3: z.string().regex(/^[A-Z]{3}$/),
  blurb: text(1000),
  tagline: text(300),
  profile_html: z.string().max(200_000, "The text is too long."),
  featured_indicators: z.array(slug(60)).max(12),
  region_slug: z.preprocess(blankToUndefined, slug(120).optional()),
});
