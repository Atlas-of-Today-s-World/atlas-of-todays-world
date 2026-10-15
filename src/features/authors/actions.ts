"use server";

import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { affected, failed, formAction, idAction } from "@/lib/actions";
import { adminRoutes, routes } from "@/config/routes";
import { tags } from "@/lib/cache/tags";
import { AuthorAccountInput, AuthorInput } from "./schema";

/** The author appears in entry headers: the lists and every article page are refreshed too. */
function refreshAuthors() {
  updateTag(tags.entries);
  updateTag(tags.entryPages);
  revalidatePath(adminRoutes.authors.list);
}

/**
 * Saves an author (RLS: anyone who may write can add a new one; someone else's
 * bio may only be changed by editors with access to all articles, DB-04).
 * A changed slug moves the public profile; the DB trigger redirects the old
 * URL there, so the redirects cache is refreshed as well.
 */
export const saveAuthor = formAction(AuthorInput, async ({ data: input, supabase }) => {
  const { id, slug, ...fields } = input;
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

  const { data: before, error: readError } = await supabase
    .from("authors")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  if (readError) return failed(readError);
  const moved = Boolean(before && slug && slug !== before.slug);

  const result = await supabase
    .from("authors")
    .update(slug ? { ...row, slug } : row)
    .eq("id", id)
    .select("id");
  if (result.error?.code === "23505") {
    const taken = "Another author profile already has this URL.";
    return { ok: false, error: taken, fieldErrors: { slug: [taken] } };
  }
  const denied = affected(result, "You can't edit this author (no permission).");
  if (denied) return denied;
  refreshAuthors();
  if (!moved || !before || !slug) return { ok: true, message: "Saved." };
  updateTag(tags.redirects);
  return {
    ok: true,
    message: `Saved. ${routes.author(before.slug)} now redirects to ${routes.author(slug)}.`,
  };
});

/**
 * Links the author profile to a team account, or unlinks it (DB
 * set_author_account: accounts "e" only, audited). The linked account may
 * then edit that bio itself.
 */
export const saveAuthorAccount = formAction(AuthorAccountInput, async ({ data, supabase }) => {
  const { error } = await supabase.rpc("set_author_account", {
    p_author: data.id,
    p_profile: data.profile_id ?? null,
  });
  if (error) return failed(error);
  revalidatePath(adminRoutes.authors(data.id));
  return {
    ok: true,
    message: data.profile_id ? "Linked to the account." : "No longer linked to an account.",
  };
});

/** Deletes an author; entries remain, just without an author profile (FK on delete set null). */
export const deleteAuthor = idAction(
  async ({ id, supabase }) => {
    const denied = affected(
      await supabase.from("authors").delete().eq("id", id).select("id"),
      "The author can't be deleted (no permission).",
    );
    if (denied) return denied;
    refreshAuthors();
    return { ok: true, message: "Deleted." };
  },
  { invalid: "Invalid author." },
);
