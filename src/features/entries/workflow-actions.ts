"use server";

import "server-only";
import {
  failed,
  formObject,
  invalid,
  NOT_SIGNED_IN,
  signedIn,
  type ActionState,
} from "@/lib/actions";
import { uuid } from "@/lib/validation/common";
import { ScheduleInput, SendBackInput } from "./schema";
import { PREVIEW_HOURS } from "./constants";
import { refreshEntry } from "./revalidate";

/**
 * The article workflow: submit, approve, send back, unpublish, schedule, and
 * the shareable preview link for reviewers.
 */

type Transition = "submit_entry" | "approve_entry" | "unpublish_entry";

const DONE: Record<Transition, string> = {
  submit_entry: "Submitted for approval.",
  approve_entry: "Approved and published.",
  unpublish_entry: "Unpublished; the article is a draft again.",
};

/** Status transitions only through an RPC function in the DB (ARCHITEKTURA 4.3) — never a direct UPDATE. */
async function transition(fn: Transition, id: string): Promise<ActionState> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid article." };
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { supabase } = session;
  const { error } = await supabase.rpc(fn, { p_entry: id });
  if (error) return failed(error);
  if (fn !== "submit_entry") await refreshEntry(supabase, id);
  return { ok: true, message: DONE[fn] };
}

export async function submitEntry(id: string) {
  return transition("submit_entry", id);
}

export async function approveEntry(id: string) {
  return transition("approve_entry", id);
}

export async function unpublishEntry(id: string) {
  return transition("unpublish_entry", id);
}

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
