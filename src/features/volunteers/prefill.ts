import { VOLUNTEER_TOPIC_PARAM } from "@/config/routes";

/**
 * The volunteer form's prefill: "Write a topic about X" links to the form with
 * the place in the query (`volunteerHref` in config/routes.ts).
 */

/** A place name is short; well under the field's 300-character limit (schema.ts). */
const MAX_PREFILL = 120;

/**
 * The prefill from a query string (`location.search`) as plain, single-line
 * text: control characters dropped, whitespace collapsed, length capped. The
 * value only ever goes into an input's `value`, never into HTML.
 */
export function topicPrefill(search: string): string {
  const raw = new URLSearchParams(search).get(VOLUNTEER_TOPIC_PARAM) ?? "";
  const clean = raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ");
  return clean.replace(/\s+/g, " ").trim().slice(0, MAX_PREFILL).trim();
}
