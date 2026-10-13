"use server";

import "server-only";
import { updateTag } from "next/cache";
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
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { htmlTooLong, slug as slugSchema, uuid } from "@/lib/validation/common";
import { BODY_HTML_MAX, BODY_TOO_LONG, EntryInput } from "./schema";
import { type Client, pingSearchEngines, refresh, refreshEntry } from "./revalidate";

/**
 * Editing an article itself: save, group, delete, restore from history. Status
 * transitions are in `workflow-actions.ts`, the parts below the article form
 * (subtopics, tiles, learn more, FAQ, SEO) in `parts-actions.ts`.
 */

/**
 * Saving a news item/entry (ARCHITEKTURA 4.3). A new article starts as the
 * author's draft; who may edit what is decided by RLS + guard_entries. A trigger
 * stores the previous version of the text in the revision history.
 */
export async function saveEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Unticked checkboxes send nothing: the layers are read only when the form showed them.
  const arrays = formData.has("map_layers_shown") ? ["countries", "map_layers"] : ["countries"];
  const parsed = EntryInput.safeParse(formObject(formData, arrays));
  if (!parsed.success) return invalid(parsed.error);
  // Sanitizing can lengthen the HTML (rel on links): check what will be stored.
  const body_html = sanitizeRichHtml(parsed.data.body_html);
  if (body_html.length > BODY_HTML_MAX) return htmlTooLong("body_html", BODY_TOO_LONG);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { supabase, user } = session;
  const { id, countries, planned, map_layers, ...fields } = parsed.data;

  const row = {
    ...fields,
    ...(map_layers ? { map_layers } : {}),
    summary: fields.summary,
    region_slug: fields.region_slug ?? null,
    special_slug: fields.special_slug ?? null,
    cover_url: fields.cover_url ?? null,
    cover_credit: fields.cover_credit || null,
    author_name: fields.author_name || null,
    reading_minutes: fields.reading_minutes ?? null,
    body_html,
    author_id: fields.author_id ?? null,
    hero_background: fields.hero_background ?? null,
  };

  let entryId = id;
  let status: string;
  if (entryId) {
    const { data: current, error: readError } = await supabase
      .from("entries")
      .select("status, slug, kind, translation_of")
      .eq("id", entryId)
      .single();
    if (readError) return failed(readError);
    // A published article doesn't change its address — links to it are already out there.
    // A translation always takes its address and kind from the original (a DB trigger enforces it too).
    const update =
      current.translation_of !== null
        ? { ...row, slug: current.slug, kind: current.kind }
        : current.status === "published"
          ? { ...row, slug: current.slug }
          : { ...row };
    const nextStatus =
      current.status === "draft" || current.status === "planned"
        ? planned
          ? "planned"
          : "draft"
        : current.status;
    const { data: updated, error } = await supabase
      .from("entries")
      .update({ ...update, status: nextStatus as "draft" | "planned" | "pending" | "published" })
      .eq("id", entryId)
      .select("id");
    if (error) return failed(error);
    // Readable but not editable: RLS filtered the update without an error.
    if (!updated.length) return { ok: false, error: "You can't edit this article." };
    status = nextStatus;
  } else {
    const { data, error } = await supabase
      .from("entries")
      .insert({ ...row, owner_id: user.id, status: planned ? "planned" : "draft" })
      .select("id")
      .single();
    if (error) return failed(error);
    entryId = data.id;
    status = "draft";
  }

  const countryError = await syncCountries(supabase, entryId, countries);
  if (countryError) return countryError;

  if (status === "published") await refreshEntry(supabase, entryId, true);
  if (!id) redirect(`/admin/content/${entryId}?saved=1`);
  return { ok: true, message: "Saved.", id: entryId };
}

async function syncCountries(
  supabase: Client,
  entryId: string,
  countries: string[],
): Promise<ActionState | null> {
  const { data: existing, error } = await supabase
    .from("entry_countries")
    .select("country_iso3")
    .eq("entry_id", entryId);
  if (error) return failed(error);
  const have = new Set(existing.map((row) => row.country_iso3));
  const want = new Set(countries);
  const remove = [...have].filter((iso3) => !want.has(iso3));
  const add = [...want].filter((iso3) => !have.has(iso3));
  if (remove.length) {
    const { error: removeError } = await supabase
      .from("entry_countries")
      .delete()
      .eq("entry_id", entryId)
      .in("country_iso3", remove);
    if (removeError) return failed(removeError);
  }
  if (add.length) {
    const { error: addError } = await supabase
      .from("entry_countries")
      .insert(add.map((country_iso3) => ({ entry_id: entryId, country_iso3 })));
    if (addError) return failed(addError);
  }
  return null;
}

/**
 * Assigns an article to a country group (global issue or custom region), or
 * detaches it (`slug` null) — from the group page, not just the article editor.
 * RLS decides who may change the article, as on save (published: approver only).
 */
export async function setEntryGroup(entryId: string, slug: string | null): Promise<ActionState> {
  if (
    !uuid.safeParse(entryId).success ||
    (slug !== null && !slugSchema(120).safeParse(slug).success)
  ) {
    return { ok: false, error: "Invalid request." };
  }
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data: before } = await session.supabase
    .from("entries")
    .select("special_slug")
    .eq("id", entryId)
    .maybeSingle();
  const { data, error } = await session.supabase
    .from("entries")
    .update({ special_slug: slug })
    .eq("id", entryId)
    .select("slug, status, region_slug");
  if (error) return failed(error);
  const row = data[0];
  if (!row) return { ok: false, error: "You can't change this article." };
  if (row.status === "published") {
    // Revalidate the portrait of both the old and the new group.
    refresh(row.slug, row.region_slug, slug);
    if (before?.special_slug && before.special_slug !== slug) {
      updateTag(tags.portrait("issue", before.special_slug));
    }
  }
  return {
    ok: true,
    message: slug ? "Article added to the group." : "Article removed from the group.",
  };
}

export async function deleteEntry(id: string): Promise<ActionState> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid article." };
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase
    .from("entries")
    .delete()
    .eq("id", id)
    .select("slug, status, region_slug, special_slug, kind, locale");
  if (error) return failed(error);
  if (!data.length)
    return {
      ok: false,
      error: "The article can't be deleted (no permission or it no longer exists).",
    };
  const [removed] = data;
  if (removed?.status === "published") {
    refresh(removed.slug, removed.region_slug, removed.special_slug);
    pingSearchEngines(removed);
  }
  return { ok: true, message: "Deleted." };
}

/** Restores text from history; the current version is itself saved as another revision. */
export async function restoreRevision(entryId: string, revisionId: number): Promise<ActionState> {
  if (!uuid.safeParse(entryId).success || !Number.isInteger(revisionId)) {
    return { ok: false, error: "Invalid revision." };
  }
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { supabase } = session;
  const { data: revision, error } = await supabase
    .from("entry_revisions")
    .select("snapshot")
    .eq("id", revisionId)
    .eq("entry_id", entryId)
    .single();
  if (error) return failed(error);
  const snapshot = revision.snapshot as {
    title: string;
    summary: string;
    body_html: string;
    cover_url: string | null;
  };
  const body_html = sanitizeRichHtml(snapshot.body_html);
  if (body_html.length > BODY_HTML_MAX) return { ok: false, error: BODY_TOO_LONG };
  const { data: updated, error: updateError } = await supabase
    .from("entries")
    .update({
      title: snapshot.title,
      summary: snapshot.summary,
      body_html,
      cover_url: snapshot.cover_url,
    })
    .eq("id", entryId)
    .select("slug, status, region_slug, special_slug, kind, locale")
    .single();
  if (updateError) return failed(updateError);
  if (updated.status === "published") {
    refresh(updated.slug, updated.region_slug, updated.special_slug);
    pingSearchEngines(updated);
  }
  return { ok: true, message: "Restored from history." };
}
