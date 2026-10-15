import type { Timeline, TimelineItem, TimelineSource } from "@/lib/content-types";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { safeUrl } from "@/lib/security/urls";
import { htmlToText, textToHtml } from "@/lib/text/html";
import { EVENT_HTML_MAX, EVENT_TEXT_MAX, type TimelineEventInput } from "./schema";

/**
 * Timeline rows ↔ what the site and the editor work with. Pure functions,
 * shared by the public reads (country, topic), the editor and the save.
 */

/** Columns of an event, the same for every owner. */
export const EVENT_COLUMNS = "position, date_label, title, body, body_html, sources, image_url";

export interface EventRow {
  position?: number;
  date_label: string;
  title: string;
  body: string;
  body_html: string;
  sources: unknown;
  image_url?: string | null;
}

/** An event as the editor holds it (rich text always set, sources as a list). */
export interface EditableEvent {
  date_label: string;
  title: string;
  body_html: string;
  sources: TimelineSource[];
  image_url: string;
}

const byPosition = (a: { position?: number }, b: { position?: number }) =>
  (a.position ?? 0) - (b.position ?? 0);

/** Stored sources, keeping only well-formed https links (the DB checks them too). */
export function toSources(raw: unknown): TimelineSource[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((source: unknown) => {
    if (typeof source !== "object" || source === null) return [];
    const { title, url } = source as Record<string, unknown>;
    const safe = typeof url === "string" && /^https:\/\/\S+$/.test(url) ? safeUrl(url) : null;
    return safe && typeof title === "string" && title.trim() ? [{ title, url: safe }] : [];
  });
}

/** Rows → events for the page; an event from before rich text keeps its plain text. */
export function toTimelineItems(rows: EventRow[]): TimelineItem[] {
  return [...rows].sort(byPosition).map((row) => ({
    title: row.title,
    date: row.date_label,
    text: row.body,
    html: row.body_html || undefined,
    sources: toSources(row.sources),
  }));
}

/** A whole timeline for the page, or null when it has no events (nothing is shown). */
export function toTimeline(
  head: { timeline_title?: string | null; timeline_subtitle?: string | null } | null,
  rows: EventRow[],
): Timeline | null {
  if (!rows.length) return null;
  return {
    title: head?.timeline_title?.trim() || undefined,
    subtitle: head?.timeline_subtitle?.trim() || undefined,
    items: toTimelineItems(rows),
  };
}

/** Rows → the editor's events: plain text from before becomes paragraphs. */
export function toEditableEvents(rows: EventRow[]): EditableEvent[] {
  return [...rows].sort(byPosition).map((row) => ({
    date_label: row.date_label,
    title: row.title,
    body_html: row.body_html || textToHtml(row.body),
    sources: toSources(row.sources),
    image_url: row.image_url ?? "",
  }));
}

/** Plain text of the rich text for `body`: one line per block, cut to the column's limit. */
export function plainText(html: string): string {
  const text = htmlToText(html, { blockEnd: "\n\n", lineBreak: "\n" })
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > EVENT_TEXT_MAX ? `${text.slice(0, EVENT_TEXT_MAX - 1).trimEnd()}…` : text;
}

/**
 * A validated event as replace_timeline() stores it: the rich text sanitized
 * (null when it is then over the column's limit), its plain text beside it.
 */
export function toStoredEvent(event: TimelineEventInput) {
  const body_html = sanitizeRichHtml(event.body_html);
  if (body_html.length > EVENT_HTML_MAX) return null;
  return {
    date_label: event.date_label,
    title: event.title,
    body: plainText(body_html),
    body_html,
    sources: event.sources,
    image_url: event.image_url ?? null,
  };
}
