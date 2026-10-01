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
import { tags } from "@/lib/cache/tags";
import { uuid } from "@/lib/validation/common";
import { AuthorInput } from "./schema";

/**
 * Saves an author (RLS: anyone who may write can add a new one; someone else's
 * bio may only be changed by editors with access to all articles, DB-04). The
 * author appears in entry headers, so the article cache is revalidated too.
 */
export async function saveAuthor(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = AuthorInput.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { id, ...fields } = parsed.data;
  const row = { ...fields, photo_url: fields.photo_url ?? null };

  if (!id) {
    const { data, error } = await session.supabase
      .from("authors")
      .insert(row)
      .select("id")
      .single();
    if (error) return failed(error);
    revalidatePath("/admin/authors");
    redirect(`/admin/authors/${data.id}?saved=1`);
  }

  const { data, error } = await session.supabase
    .from("authors")
    .update(row)
    .eq("id", id)
    .select("id");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "You can't edit this author (no permission)." };
  updateTag(tags.entries);
  revalidatePath("/admin/authors");
  return { ok: true, message: "Saved." };
}

/** Deletes an author; entries remain, just without an author profile (FK on delete set null). */
export async function deleteAuthor(id: string): Promise<ActionState> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid author." };
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase.from("authors").delete().eq("id", id).select("id");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "The author can't be deleted (no permission)." };
  updateTag(tags.entries);
  revalidatePath("/admin/authors");
  return { ok: true, message: "Deleted." };
}
