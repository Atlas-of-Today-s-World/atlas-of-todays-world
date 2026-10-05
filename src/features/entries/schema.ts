import { z } from "zod";
import { NEWS_CATEGORIES } from "@/lib/content-types";
import {
  blankToUndefined,
  httpsUrl,
  iso3,
  optionalHttpsUrl,
  optionalNumber,
  requiredText,
  slug,
  text,
  uuid,
} from "@/lib/validation/common";
import {
  GEO_SUMMARY_MAX,
  MAP_LAYERS,
  MAX_LINKS,
  MAX_TILES,
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  TILE_ICONS,
} from "./constants";

/** Tile background colour (DB `is_hex_color`); empty = none. */
const hexColor = z.preprocess(
  blankToUndefined,
  z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #1f3a5f.")
    .optional(),
);

/** Section label of a topic ("Articles", "Learn more"); empty = the template's. */
const sectionLabel = text(40).default("");

/** Text with one item per line → list of non-empty lines (trim removes CR). */
const lines = (value: unknown) =>
  typeof value === "string"
    ? value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : value;

/** Summary bullets for entries and chapters: at most 5 of 300 characters (DB `short_items`). */
const summaryPoints = z.preprocess(
  lines,
  z.array(text(300)).max(5, "At most 5 bullet points, one per line."),
);

/** News/entry editor input — limits matching the `entries` table. */
export const EntryInput = z.object({
  id: z.preprocess(blankToUndefined, uuid.optional()),
  slug: slug(120),
  kind: z.enum(["news", "entry"]).default("news"),
  title: requiredText(200),
  summary: text(600),
  category: z.enum(NEWS_CATEGORIES as [string, ...string[]], {
    message: "Choose a category.",
  }),
  region_slug: z.preprocess(blankToUndefined, slug(120).optional()),
  special_slug: z.preprocess(blankToUndefined, slug(120).optional()),
  cover_url: optionalHttpsUrl,
  cover_credit: text(300),
  author_name: text(120),
  reading_minutes: optionalNumber(z.number().int().min(1).max(180)),
  body_html: z.string().max(400_000, "The text is too long."),
  countries: z.array(iso3).max(60, "At most 60 countries."),
  planned: z.preprocess((value) => value === "on", z.boolean()),
  // Encyclopedia entries only (P9); left empty for news.
  summary_points: summaryPoints.default([]),
  author_id: z.preprocess(blankToUndefined, uuid.optional()),
  // Topics only (the form marks it with `map_layers_shown`): globe layers it is counted on.
  map_layers: z.array(z.enum(MAP_LAYERS)).optional(),
});
export type EntryInput = z.infer<typeof EntryInput>;

/** Entry chapter — limits matching the `entry_chapters` table. */
export const ChapterInput = z.object({
  title: requiredText(200),
  summary_points: summaryPoints,
  body_html: z.string().max(200_000, "The chapter text is too long."),
  illustration_url: optionalHttpsUrl,
  illustration_credit: text(300).default(""),
  // Chapter audio version (R4) — per chapter, so the file fits within 50 MB.
  audio_url: optionalHttpsUrl,
  tile_background: hexColor,
});
export type ChapterInput = z.infer<typeof ChapterInput>;

export const CHAPTER_FIELD_LABEL: Record<string, string> = {
  title: "title",
  summary_points: "summary",
  body_html: "text",
  illustration_url: "illustration",
  illustration_credit: "illustration credit",
  audio_url: "audio",
  tile_background: "tile colour",
};

export const SendBackInput = z.object({
  id: uuid,
  note: requiredText(2000),
});

/** Earliest and latest a publication can be scheduled (matches schedule_entry in the DB). */
const SCHEDULE_MIN_MINUTES = 5;
const SCHEDULE_MAX_DAYS = 365;

/**
 * Scheduled publication: time as ISO with offset (the browser converts local time
 * from the datetime-local field). The DB function also enforces the 5-minute-to-1-year window.
 */
export const ScheduleInput = z.object({
  id: uuid,
  publish_at: z.iso
    .datetime({ offset: true, message: "Enter a date and time." })
    .refine((value) => {
      const at = Date.parse(value);
      const now = Date.now();
      return (
        at >= now + SCHEDULE_MIN_MINUTES * 60_000 && at <= now + SCHEDULE_MAX_DAYS * 86_400_000
      );
    }, `The time must be at least ${SCHEDULE_MIN_MINUTES} minutes ahead and at most a year away.`),
});

export const ENTRY_STATUSES = ["draft", "pending", "published", "planned"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const STATUS_LABEL: Record<EntryStatus, string> = {
  draft: "Draft",
  pending: "Pending approval",
  published: "Published",
  planned: "Scheduled",
};

/** One "Learn more" tile of a topic or a template — limits as `learn_more_tiles`. */
export const TileItem = z.object({
  id: z.preprocess(blankToUndefined, uuid.optional()),
  slug: slug(60),
  label: requiredText(60),
  description: text(200).default(""),
  icon: z.enum(TILE_ICONS),
  image_url: optionalHttpsUrl,
  image_credit: text(300).default(""),
  background: hexColor,
});
export type TileItem = z.infer<typeof TileItem>;

export const TILE_FIELD_LABEL: Record<string, string> = {
  slug: "address",
  label: "label",
  description: "description",
  icon: "icon",
  image_url: "photo",
  image_credit: "photo credit",
  background: "colour",
};

/** All tiles of a topic or a template, saved at once; addresses (slugs) unique. */
export const TilesInput = z
  .array(TileItem)
  .max(MAX_TILES, `At most ${MAX_TILES} tiles.`)
  .refine(
    (tiles) => new Set(tiles.map((tile) => tile.slug)).size === tiles.length,
    "Two tiles have the same label — rename one of them.",
  );

/** Labels of a topic's two halves; empty = the default text. */
export const TopicLabelsInput = z.object({
  articles_label: sectionLabel,
  learn_more_label: sectionLabel,
});

/** A topic template's own fields (its tiles come as `TilesInput`). */
export const TemplateInput = z.object({
  id: z.preprocess(blankToUndefined, uuid.optional()),
  name: requiredText(80),
  description: text(300).default(""),
  articles_label: requiredText(40),
  learn_more_label: requiredText(40),
});

/** One comma- or line-separated list → trimmed, de-duplicated keywords. */
const keywords = z.preprocess(
  (value) =>
    typeof value === "string"
      ? [
          ...new Set(
            value
              .split(/[,\n]/)
              .map((word) => word.trim())
              .filter(Boolean),
          ),
        ]
      : value,
  z.array(text(60)).max(12, "At most 12 keywords."),
);

/** SEO & GEO overrides of a dossier — empty means "use the default". */
export const SeoInput = z.object({
  entry_id: uuid,
  seo_title: text(SEO_TITLE_MAX).default(""),
  seo_description: text(SEO_DESCRIPTION_MAX).default(""),
  og_image_url: optionalHttpsUrl,
  seo_keywords: keywords.default([]),
  geo_summary: text(GEO_SUMMARY_MAX).default(""),
  noindex: z.preprocess((value) => value === "on", z.boolean()),
});

/** A link inside a learn-more tile (same limits as portrait resources). */
const TileLink = z.object({
  title: requiredText(200),
  source: text(120).default(""),
  description: text(600).default(""),
  url: httpsUrl,
  image_url: optionalHttpsUrl,
});

/** Learn-more content of one dossier: links per tile (notes come as rich-text fields). */
export const LearnMoreInput = z
  .array(z.object({ tile_id: uuid, links: z.array(TileLink).max(MAX_LINKS) }))
  .max(MAX_TILES)
  .refine(
    (tiles) => tiles.reduce((sum, tile) => sum + tile.links.length, 0) <= MAX_LINKS,
    `A topic holds at most ${MAX_LINKS} links.`,
  );
