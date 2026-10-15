import "server-only";
import { must, rowsOf } from "@/lib/db/result";
import { createServerClient, type ServerClient } from "@/lib/supabase/server";
import { EVENT_COLUMNS, toEditableEvents, type EditableEvent, type EventRow } from "./rows";
import type { TimelineOwnerKind } from "./constants";

/**
 * A timeline for the editor (under the user's session, no cache): its heading
 * and events in order, in the shape the editor posts them back.
 */

/** The column of an event that names its owner. */
const OWNER_COLUMN = {
  region: "region_slug",
  issue: "special_slug",
  country: "country_iso3",
  topic: "entry_id",
} as const satisfies Record<TimelineOwnerKind, string>;

const HEAD = "timeline_title, timeline_subtitle";

/** The heading, stored on the owner's own row. */
function headOf(supabase: ServerClient, kind: TimelineOwnerKind, key: string) {
  switch (kind) {
    case "region":
      return supabase.from("regions").select(HEAD).eq("slug", key).maybeSingle();
    case "issue":
      return supabase.from("special_regions").select(HEAD).eq("slug", key).maybeSingle();
    case "country":
      return supabase.from("countries").select(HEAD).eq("iso3", key).maybeSingle();
    case "topic":
      return supabase.from("entries").select(HEAD).eq("id", key).maybeSingle();
  }
}

export interface EditableTimeline {
  title: string;
  subtitle: string;
  events: EditableEvent[];
}

export async function timelineForEdit(
  kind: TimelineOwnerKind,
  key: string,
): Promise<EditableTimeline> {
  const supabase = await createServerClient();
  const [head, events] = await Promise.all([
    headOf(supabase, kind, key),
    supabase
      .from("timeline_events")
      .select(EVENT_COLUMNS)
      .eq(OWNER_COLUMN[kind], key)
      .order("position"),
  ]);
  const row = must(head, "timeline: heading");
  return {
    title: row?.timeline_title ?? "",
    subtitle: row?.timeline_subtitle ?? "",
    events: toEditableEvents(rowsOf(events, "timeline: events") as EventRow[]),
  };
}
