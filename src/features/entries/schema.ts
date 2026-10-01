import { z } from "zod";
import { NEWS_CATEGORIES } from "@/lib/content-types";
import {
  blankToUndefined,
  iso3,
  optionalHttpsUrl,
  optionalNumber,
  requiredText,
  slug,
  text,
  uuid,
} from "@/lib/validation/common";

/** Text s jednou položkou na řádek → seznam neprázdných řádků (CR odstraní trim). */
const lines = (value: unknown) =>
  typeof value === "string"
    ? value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : value;

/** Odrážky shrnutí hesla i kapitoly: nejvýš 5 po 300 znacích (DB `short_items`). */
const summaryPoints = z.preprocess(
  lines,
  z.array(text(300)).max(5, "Nejvýš 5 odrážek, jedna na řádek."),
);

/** Vstup editoru novinky/hesla — limity shodné s tabulkou `entries`. */
export const EntryInput = z.object({
  id: z.preprocess(blankToUndefined, uuid.optional()),
  slug: slug(120),
  kind: z.enum(["news", "entry"]).default("news"),
  title: requiredText(200),
  summary: text(600),
  category: z.enum(NEWS_CATEGORIES as [string, ...string[]], {
    message: "Vyberte kategorii.",
  }),
  region_slug: z.preprocess(blankToUndefined, slug(120).optional()),
  special_slug: z.preprocess(blankToUndefined, slug(120).optional()),
  cover_url: optionalHttpsUrl,
  cover_credit: text(300),
  author_name: text(120),
  reading_minutes: optionalNumber(z.number().int().min(1).max(180)),
  body_html: z.string().max(400_000, "Text je příliš dlouhý."),
  countries: z.array(iso3).max(60, "Nejvýš 60 zemí."),
  planned: z.preprocess((value) => value === "on", z.boolean()),
  // Jen u encyklopedického hesla (P9); u novinky zůstanou prázdné.
  summary_points: summaryPoints.default([]),
  audio_url: optionalHttpsUrl,
  author_id: z.preprocess(blankToUndefined, uuid.optional()),
});
export type EntryInput = z.infer<typeof EntryInput>;

/** Nejvýš kapitol v hesle (zadání chce 4–6; DB pustí 8). */
export const MAX_CHAPTERS = 8;

/** Kapitola hesla — limity shodné s tabulkou `entry_chapters`. */
export const ChapterInput = z.object({
  title: requiredText(200),
  summary_points: summaryPoints,
  body_html: z.string().max(200_000, "Text kapitoly je příliš dlouhý."),
  illustration_url: optionalHttpsUrl,
  illustration_credit: text(300).default(""),
});
export type ChapterInput = z.infer<typeof ChapterInput>;

export const CHAPTER_FIELD_LABEL: Record<string, string> = {
  title: "titulek",
  summary_points: "shrnutí",
  body_html: "text",
  illustration_url: "ilustrace",
  illustration_credit: "kredit ilustrace",
};

export const SendBackInput = z.object({
  id: uuid,
  note: requiredText(2000),
});

/** Nejdřív a nejpozději lze zveřejnění naplánovat (shodné se schedule_entry v DB). */
const SCHEDULE_MIN_MINUTES = 5;
const SCHEDULE_MAX_DAYS = 365;

/**
 * Plánované zveřejnění: čas jako ISO s posunem (prohlížeč převede místní čas
 * z pole datetime-local). Okno 5 minut až rok hlídá i DB funkce.
 */
export const ScheduleInput = z.object({
  id: uuid,
  publish_at: z.iso.datetime({ offset: true, message: "Zadejte datum a čas." }).refine((value) => {
    const at = Date.parse(value);
    const now = Date.now();
    return at >= now + SCHEDULE_MIN_MINUTES * 60_000 && at <= now + SCHEDULE_MAX_DAYS * 86_400_000;
  }, `Čas musí být aspoň ${SCHEDULE_MIN_MINUTES} minut dopředu a nejvýš za rok.`),
});

export const ENTRY_STATUSES = ["draft", "pending", "published", "planned"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const STATUS_LABEL: Record<EntryStatus, string> = {
  draft: "Koncept",
  pending: "Čeká na schválení",
  published: "Zveřejněno",
  planned: "Plánováno",
};

/** Doby platnosti sdíleného náhledu v hodinách (DB povolí 1 až 720). */
export const PREVIEW_HOURS = [24, 72, 168, 720] as const;
