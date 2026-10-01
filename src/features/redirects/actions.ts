"use server";

import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import {
  failed,
  formObject,
  invalid,
  NOT_SIGNED_IN,
  signedIn,
  type ActionState,
} from "@/lib/actions";
import { tags } from "@/lib/cache/tags";
import { RedirectId, RedirectInput } from "./schema";

/** Přidá přesměrování (RLS: sekce news „c"; smyčky a tvar cest hlídá DB). */
export async function addRedirect(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = RedirectInput.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { error } = await session.supabase.from("redirects").insert(parsed.data);
  if (error) return failed(error);
  updateTag(tags.redirects);
  revalidatePath("/admin/redirects");
  return { ok: true, message: `Redirect added: ${parsed.data.from_path} → ${parsed.data.to_path}` };
}

/** Smaže přesměrování (RLS: sekce news „d"). */
export async function deleteRedirect(id: string): Promise<ActionState> {
  if (!RedirectId.safeParse(id).success) return { ok: false, error: "Invalid redirect." };
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase
    .from("redirects")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "The redirect can't be deleted (no permission)." };
  updateTag(tags.redirects);
  revalidatePath("/admin/redirects");
  return { ok: true, message: "Deleted." };
}
