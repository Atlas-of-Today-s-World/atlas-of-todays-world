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
import { GEO_SUMMARY_MAX, SEO_DESCRIPTION_MAX, SEO_TITLE_MAX, TILE_ICONS } from "./constants";

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
});
export type ChapterInput = z.infer<typeof ChapterInput>;

export const CHAPTER_FIELD_LABEL: Record<string, string> = {
  title: "title",
  summary_points: "summary",
  body_html: "text",
  illustration_url: "illustration",
  illustration_credit: "illustration credit",
  audio_url: "audio",
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

/** A learn-more tile: default (no entry) or of one dossier — limits as `learn_more_tiles`. */
export const TileInput = z.object({
  id: z.preprocess(blankToUndefined, uuid.optional()),
  entry_id: z.preprocess(blankToUndefined, uuid.optional()),
  slug: z.preprocess(blankToUndefined, slug(60).optional()),
  label: requiredText(60),
  description: text(200).default(""),
  icon: z.enum(TILE_ICONS),
  image_url: optionalHttpsUrl,
  image_credit: text(300).default(""),
  position: optionalNumber(z.number().int().min(0).max(99)),
});
export type TileInput = z.infer<typeof TileInput>;

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
  .array(z.object({ tile_id: uuid, links: z.array(TileLink).max(50) }))
  .max(30)
  .refine(
    (tiles) => tiles.reduce((sum, tile) => sum + tile.links.length, 0) <= 50,
    "A dossier holds at most 50 links.",
  );
