"use server";

import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  failed,
  formObject,
  invalid,
  NOT_SIGNED_IN,
  signedIn,
  type ActionState,
} from "@/lib/actions";
import { adminRoutes } from "@/config/routes";
import { tags } from "@/lib/cache/tags";
import { uuid } from "@/lib/validation/common";
import { PatronFaqInput, PatronSettingsInput } from "./settings";

/**
 * Atlas Patrons settings and FAQ (/admin/patrons). RLS decides: the `site` or
 * `members` section — "e" changes the settings and questions, "c" adds and
 * "d" deletes a question. Every write refreshes the public membership page,
 * the checkout validation and the FAQ (tags.patrons).
 */

const ADMIN_PAGE = adminRoutes.patrons;

function changed() {
  updateTag(tags.patrons);
  revalidatePath(ADMIN_PAGE);
}

/** Donation amounts, defaults, "Other amount" and the goal — the single settings row. */
export async function savePatronSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = PatronSettingsInput.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase
    .from("patron_settings")
    .update(parsed.data)
    .eq("id", 1)
    .select("id");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "You can't change the patron settings." };
  changed();
  return { ok: true, message: "Saved. The membership page shows the new values." };
}

/** Adds a question (at the end of the list) or saves an existing one. */
export async function savePatronFaq(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = PatronFaqInput.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { id, ...fields } = parsed.data;

  if (!id) {
    const { data: lastRow } = await session.supabase
      .from("patron_faq")
      .select("sort")
      .order("sort", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await session.supabase
      .from("patron_faq")
      .insert({ ...fields, sort: Math.min((lastRow?.sort ?? 0) + 10, 100_000) })
      .select("id")
      .single();
    if (error) return failed(error);
    changed();
    redirect(`${ADMIN_PAGE}/faq/${data.id}?saved=1`);
  }

  const { data, error } = await session.supabase
    .from("patron_faq")
    .update(fields)
    .eq("id", id)
    .select("id");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "You can't edit this question (no permission)." };
  changed();
  return { ok: true, message: "Saved." };
}

export async function deletePatronFaq(id: string): Promise<ActionState> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid question." };
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase
    .from("patron_faq")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "The question can't be deleted (no permission)." };
  changed();
  return { ok: true, message: "Deleted." };
}

/** Moves a question one place up or down (move_patron_faq: one transaction, RLS applies). */
export async function movePatronFaq(id: string, up: boolean): Promise<ActionState> {
  if (!uuid.safeParse(id).success || typeof up !== "boolean") {
    return { ok: false, error: "Invalid question." };
  }
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { error } = await session.supabase.rpc("move_patron_faq", { p_id: id, p_up: up });
  if (error) return failed(error);
  changed();
  return { ok: true, message: "Moved." };
}
