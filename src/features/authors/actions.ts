"use server";

import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { affected, failed, formAction, idAction } from "@/lib/actions";
import { adminRoutes } from "@/config/routes";
import { tags } from "@/lib/cache/tags";
import { AuthorInput } from "./schema";

/**
 * Saves an author (RLS: anyone who may write can add a new one; someone else's
 * bio may only be changed by editors with access to all articles, DB-04). The
 * author appears in entry headers, so the lists and every article page are
 * revalidated too.
 */
export const saveAuthor = formAction(AuthorInput, async ({ data: input, supabase }) => {
  const { id, ...fields } = input;
  const row = { ...fields, photo_url: fields.photo_url ?? null };

  if (!id) {
    const { data, error } = await supabase
      .from("authors")
      // Empty slug = the DB generates a unique one from the name (/authors/<slug>).
      .insert({ ...row, slug: "" })
      .select("id")
      .single();
    if (error) return failed(error);
    revalidatePath(adminRoutes.authors.list);
    redirect(adminRoutes.authors(data.id, { saved: "1" }));
  }

  const denied = affected(
    await supabase.from("authors").update(row).eq("id", id).select("id"),
    "You can't edit this author (no permission).",
  );
  if (denied) return denied;
  updateTag(tags.entries);
  updateTag(tags.entryPages);
  revalidatePath(adminRoutes.authors.list);
  return { ok: true, message: "Saved." };
});

/** Deletes an author; entries remain, just without an author profile (FK on delete set null). */
export const deleteAuthor = idAction(
  async ({ id, supabase }) => {
    const denied = affected(
      await supabase.from("authors").delete().eq("id", id).select("id"),
      "The author can't be deleted (no permission).",
    );
    if (denied) return denied;
    updateTag(tags.entries);
    updateTag(tags.entryPages);
    revalidatePath(adminRoutes.authors.list);
    return { ok: true, message: "Deleted." };
  },
  { invalid: "Invalid author." },
);
