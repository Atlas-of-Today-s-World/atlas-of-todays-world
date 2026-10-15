import { z } from "zod";
import {
  blankToUndefined,
  httpsUrl,
  iso3,
  optionalHttpsUrl,
  requiredText,
  SLUG,
  text,
  uuid,
} from "@/lib/validation/common";
import { MAX_SOURCES, TIMELINE_OWNERS, type TimelineOwnerKind } from "./constants";

/**
 * A timeline as the editor posts it and replace_timeline() stores it (migration
 * 20261015000050). Limits match the DB CHECKs: title 200, date 60, rich text
 * 20 000 after sanitizing, at most 20 sources {title ≤ 300, https URL ≤ 1000}
 * per event, at most 60 events, heading 120 / subheading 300.
 */

/** Longest stored rich text of one event (`timeline_events.body_html`). */
export const EVENT_HTML_MAX = 20_000;
/** Longest plain text kept beside it (`timeline_events.body`). */
export const EVENT_TEXT_MAX = 2000;
export const EVENT_TOO_LONG = "The text is too long.";

/** The owner's key: a region / issue slug, a country's ISO3 code, a topic's id. */
const KEY: Record<TimelineOwnerKind, z.ZodType<string>> = {
  region: z.string().regex(SLUG).max(120),
  issue: z.string().regex(SLUG).max(120),
  country: iso3,
  topic: uuid,
};

export const TimelineOwner = z
  .object({ kind: z.enum(TIMELINE_OWNERS), key: z.string() })
  .refine((owner) => KEY[owner.kind].safeParse(owner.key).success, "Invalid timeline.");
export type TimelineOwner = z.infer<typeof TimelineOwner>;

/** A source's name; left empty, the link's host stands in ("www.britannica.com"). */
function withTitle(raw: unknown) {
  if (typeof raw !== "object" || raw === null) return raw;
  const source = raw as Record<string, unknown>;
  if (typeof source.title === "string" && source.title.trim()) return source;
  try {
    return { ...source, title: new URL(String(source.url ?? "")).host };
  } catch {
    return source;
  }
}

export const TimelineSourceInput = z.preprocess(
  withTitle,
  z.object({
    title: requiredText(300),
    url: httpsUrl,
  }),
);

export const TimelineEventInput = z.object({
  date_label: requiredText(60),
  title: requiredText(200),
  // Checked again after sanitizing (which can lengthen it), against EVENT_HTML_MAX.
  body_html: z
    .string()
    .max(EVENT_HTML_MAX * 2, EVENT_TOO_LONG)
    .default(""),
  sources: z.array(TimelineSourceInput).max(MAX_SOURCES, `At most ${MAX_SOURCES} sources.`),
  // Kept as it was: older events may carry an image the editor doesn't show.
  image_url: optionalHttpsUrl,
});
export type TimelineEventInput = z.infer<typeof TimelineEventInput>;

export const TimelineHeadInput = z.object({
  timeline_title: z.preprocess(blankToUndefined, text(120).optional()),
  timeline_subtitle: z.preprocess(blankToUndefined, text(300).optional()),
});

/** "Event 3, Source: …" in the editor's error line. */
export const EVENT_FIELD_LABEL: Record<string, string> = {
  date_label: "date",
  title: "title",
  body_html: "text",
  sources: "sources",
  image_url: "image",
};
