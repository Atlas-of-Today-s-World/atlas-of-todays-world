"use server";

import "server-only";
import { updateTag } from "next/cache";
import { tags } from "@/lib/cache/tags";
import {
  failed,
  formObject,
  invalid,
  NOT_SIGNED_IN,
  signedIn,
  type ActionState,
} from "@/lib/actions";
import { uuid } from "@/lib/validation/common";
import { EntryVersion, ScheduleInput, SendBackInput } from "./schema";
import { PREVIEW_HOURS } from "./constants";
import { refreshEntry } from "./revalidate";

/**
 * The article workflow: submit, withdraw, approve, send back, unpublish,
 * schedule, and the shareable preview link for reviewers.
 */

type Transition = "submit_entry" | "withdraw_entry" | "approve_entry" | "unpublish_entry";

const DONE: Record<Transition, string> = {
  submit_entry: "Submitted for approval.",
  withdraw_entry: "Withdrawn from review; the article is a draft again.",
  approve_entry: "Approved and published.",
  unpublish_entry: "Unpublished; the article is a draft again.",
};

/** Status transitions only through an RPC function in the DB (ARCHITEKTURA 4.3) — never a direct UPDATE. */
async function transition(
  fn: Transition,
  id: string,
  expectedUpdatedAt?: string,
): Promise<ActionState> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid article." };
  if (expectedUpdatedAt !== undefined && !EntryVersion.safeParse(expectedUpdatedAt).success) {
    return { ok: false, error: "Invalid article version." };
  }
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { supabase } = session;
  const { error } =
    fn === "approve_entry"
      ? await supabase.rpc(fn, { p_entry: id, p_expected_updated_at: expectedUpdatedAt })
      : await supabase.rpc(fn, { p_entry: id });
  if (error) return failed(error);
  // Submitting or withdrawing touches only articles that aren't on the site.
  if (fn === "approve_entry" || fn === "unpublish_entry") {
    const entry = await refreshEntry(supabase, id);
    // Publishing a news article can switch News into the menu (DB trigger
    // news_menu_on_publish → feature_flags.news_menu), which every page's header reads.
    if (fn === "approve_entry" && entry?.kind === "news") updateTag(tags.flags);
  }
  return { ok: true, message: DONE[fn] };
}

export async function submitEntry(id: string) {
  return transition("submit_entry", id);
}

/**
 * Takes a pending article back from review (DB `withdraw_entry`): while it waits
 * for approval nobody but an approver may change it, so the author withdraws it
 * to edit it again.
 */
export async function withdrawEntry(id: string) {
  return transition("withdraw_entry", id);
}

/**
 * Approves and publishes. `expectedUpdatedAt` is the version the approver saw;
 * the DB refuses the approval if the article changed since.
 */
export async function approveEntry(id: string, expectedUpdatedAt?: string) {
  return transition("approve_entry", id, expectedUpdatedAt);
}

export async function unpublishEntry(id: string) {
  return transition("unpublish_entry", id);
}

/**
 * Sends a pending article back to its author. `send_back_entry` (like
 * `schedule_entry` / `unschedule_entry` below) only touches articles in
 * `pending`, which are never on the site — nothing public changes, so no
 * cache is refreshed.
 */
export async function sendBackEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = SendBackInput.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { error } = await session.supabase.rpc("send_back_entry", {
    p_entry: parsed.data.id,
    p_note: parsed.data.note,
  });
  if (error) return failed(error);
  return { ok: true, message: "Returned to the author with a note." };
}

/**
 * Schedules publication of a pending article (DB `schedule_entry` — only someone
 * who may approve the article). pg_cron publishes it at the given time; the site
 * refreshes within PUBLIC_REVALIDATE_SECONDS, so the cache isn't purged here.
 */
export async function scheduleEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = ScheduleInput.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { error } = await session.supabase.rpc("schedule_entry", {
    p_entry: parsed.data.id,
    p_at: parsed.data.publish_at,
  });
  if (error) return failed(error);
  return { ok: true, message: "Publication scheduled." };
}

export async function unscheduleEntry(id: string): Promise<ActionState> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid article." };
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { error } = await session.supabase.rpc("unschedule_entry", { p_entry: id });
  if (error) return failed(error);
  return { ok: true, message: "Schedule canceled; the article is still pending approval." };
}

/**
 * Shareable article preview link (G2). Only someone who edits or approves the
 * article may create it (create_preview_link decides). The token is returned
 * only now; the database stores just its hash.
 */
export async function createPreviewLink(
  entryId: string,
  hours: number,
): Promise<ActionState & { token?: string }> {
  if (!uuid.safeParse(entryId).success || !PREVIEW_HOURS.includes(hours as never)) {
    return { ok: false, error: "Invalid request." };
  }
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase.rpc("create_preview_link", {
    p_entry: entryId,
    p_hours: hours,
  });
  if (error) return failed(error);
  return { ok: true, token: data };
}
