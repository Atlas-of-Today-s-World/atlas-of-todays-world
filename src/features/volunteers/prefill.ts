import { MEMBERSHIP_PATH, VOLUNTEER_ID } from "@/features/membership/config";

/**
 * "Write a topic about X" leads to the volunteer form on /membership with the
 * place already filled in (?topic=X#volunteer) instead of a mailto:, which
 * fails for the many visitors without a mail client.
 */
const TOPIC_PARAM = "topic";

/** A place name is short; well under the field's 300-character limit (schema.ts). */
const MAX_PREFILL = 120;

/** Link to the volunteer application form, prefilled with `place`. */
export function volunteerHref(place: string): string {
  const query = new URLSearchParams({ [TOPIC_PARAM]: place });
  return `${MEMBERSHIP_PATH}?${query.toString()}#${VOLUNTEER_ID}`;
}

/**
 * The prefill from a query string (`location.search`) as plain, single-line
 * text: control characters dropped, whitespace collapsed, length capped. The
 * value only ever goes into an input's `value`, never into HTML.
 */
export function topicPrefill(search: string): string {
  const raw = new URLSearchParams(search).get(TOPIC_PARAM) ?? "";
  const clean = raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ");
  return clean.replace(/\s+/g, " ").trim().slice(0, MAX_PREFILL).trim();
}
