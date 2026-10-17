"use server";

import "server-only";
import { updateTag } from "next/cache";
import { z } from "zod";
import { failed, formObject, invalid, listItemError, NOT_SIGNED_IN, signedIn } from "@/lib/actions";
import type { ActionState } from "@/lib/action-state";
import { tags } from "@/lib/cache/tags";
import { refreshEntry } from "@/features/entries/revalidate";
import { MAX_EVENTS } from "./constants";
import { toStoredEvent } from "./rows";
import {
  EVENT_FIELD_LABEL,
  EVENT_TOO_LONG,
  TimelineEventInput,
  TimelineHeadInput,
  TimelineOwner,
} from "./schema";

/**
 * Saves a whole timeline — heading, subheading and every event in order — with
 * one call to the DB function `replace_timeline` (one transaction; it checks
 * the same rights as the row policies: region / issue texts by article editors
 * over all articles, a country by who edits its profile, a topic by who may
 * write its parts). The form posts each event's fields under the same names in
 * page order (as the subtopics editor does) and its sources as JSON.
 */
export async function saveTimeline(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const owner = TimelineOwner.safeParse({
    kind: formData.get("kind"),
    key: formData.get("key"),
  });
  if (!owner.success) return { ok: false, error: "Invalid timeline." };
  const head = TimelineHeadInput.safeParse(formObject(formData));
  if (!head.success) return invalid(head.error);

  const column = (name: string) => formData.getAll(name).map(String);
  const [dates, titles, bodies, sources, images] = [
    column("date_label"),
    column("title"),
    column("body_html"),
    column("sources"),
    column("image_url"),
  ];
  let rawSources: unknown[];
  try {
    rawSources = sources.map((value) => JSON.parse(value || "[]") as unknown);
  } catch {
    return { ok: false, error: "Invalid timeline data." };
  }
  const events = z
    .array(TimelineEventInput)
    .max(MAX_EVENTS, `At most ${MAX_EVENTS} events.`)
    .safeParse(
      titles.map((title, index) => ({
        title,
        date_label: dates[index],
        body_html: bodies[index],
        sources: rawSources[index] ?? [],
        image_url: images[index],
      })),
    );
  if (!events.success) return listItemError(events.error, "Event", EVENT_FIELD_LABEL);
  const stored = events.data.map(toStoredEvent);
  // Sanitizing can lengthen the HTML (rel on links): check what will be stored.
  const tooLong = stored.findIndex((event) => event === null);
  if (tooLong >= 0) {
    return {
      ok: false,
      error: `Event ${tooLong + 1}, ${EVENT_FIELD_LABEL.body_html}: ${EVENT_TOO_LONG}`,
    };
  }

  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { kind, key } = owner.data;
  const { error } = await session.supabase.rpc("replace_timeline", {
    p_kind: kind,
    p_key: key,
    p_title: head.data.timeline_title ?? "",
    p_subtitle: head.data.timeline_subtitle ?? "",
    p_events: stored,
  });
  if (error) return failed(error);

  // A region's timeline is also part of the regional profile under its countries
  // (same cached portrait); a topic's page is refreshed when it is live.
  if (kind === "region" || kind === "issue") updateTag(tags.portrait(kind, key));
  else if (kind === "country") updateTag(tags.country(key));
  else await refreshEntry(session.supabase, key, true);
  return { ok: true, message: "Timeline saved." };
}
