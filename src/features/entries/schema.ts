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
});
export type EntryInput = z.infer<typeof EntryInput>;

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
