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
import { isSitePageSlug, type SitePageSlug } from "./pages";
import { RevisionId, SitePageInput } from "./schema";

const NO_PERMISSION: ActionState = {
  ok: false,
  error: "You can't edit this page (no permission).",
};

/** The page on the website and its admin screens show the change right away. */
function refresh(slug: SitePageSlug) {
  updateTag(tags.sitePage(slug));
  revalidatePath("/admin/pages");
  revalidatePath(`/admin/pages/${slug}`);
}

/**
 * Saves a site page (RLS: site "e" to change, "c" to create a missing row).
 * Published directly — no approval; the database keeps every saved version
 * in site_page_revisions (trigger), so any save can be undone.
 */
export async function saveSitePage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = SitePageInput.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { slug, ...fields } = parsed.data;
  const row = { ...fields, last_reviewed: fields.last_reviewed ?? null };

  const { data, error } = await session.supabase
    .from("site_pages")
    .update(row)
    .eq("slug", slug)
    .select("slug");
  if (error) return failed(error);
  if (!data.length) {
    // No row yet (a page added in code before its seed) — or no right to edit it.
    const { error: insertError } = await session.supabase
      .from("site_pages")
      .insert({ slug, ...row });
    if (insertError) return insertError.code === "23505" ? NO_PERMISSION : failed(insertError);
  }
  refresh(slug);
  // Back to the editor with the saved values (the form remounts with them).
  redirect(`/admin/pages/${slug}?saved=1`);
}

/** Restores a saved version's text (the current one stays in the history). */
export async function restoreSitePageRevision(
  slug: string,
  revisionId: number,
): Promise<ActionState> {
  if (!isSitePageSlug(slug) || !RevisionId.safeParse(revisionId).success) {
    return { ok: false, error: "Invalid version." };
  }
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data: restored, error } = await session.supabase.rpc("restore_site_page", {
    p_revision: revisionId,
  });
  if (error) return failed(error);
  // The database says which page the version belonged to.
  refresh(isSitePageSlug(restored) ? restored : slug);
  return { ok: true, message: "Restored from history." };
}
