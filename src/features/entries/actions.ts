"use server";

import "server-only";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  failed,
  formObject,
  invalid,
  listItemError,
  NOT_SIGNED_IN,
  signedIn,
  type ActionState,
} from "@/lib/actions";
import { tags } from "@/lib/cache/tags";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { DEFAULT_LOCALE, isLocale } from "@/features/i18n/config";
import { slug as slugSchema, uuid } from "@/lib/validation/common";
import { COLLECTIONS } from "@/features/portraits/schema";
import {
  CHAPTER_FIELD_LABEL,
  ChapterInput,
  EntryInput,
  ScheduleInput,
  SendBackInput,
} from "./schema";
import { MAX_CHAPTERS, PREVIEW_HOURS } from "./constants";

/** After published content changes, revalidate lists, detail and portraits. */
function refresh(slug?: string | null, region?: string | null, issue?: string | null) {
  updateTag(tags.entries);
  if (slug) updateTag(tags.entry(slug));
  if (region) updateTag(tags.portrait("region", region));
  if (issue) updateTag(tags.portrait("issue", issue));
}

/**
 * Saving a news item/entry (ARCHITEKTURA 4.3). A new article starts as the
 * author's draft; who may edit what is decided by RLS + guard_entries. A trigger
 * stores the previous version of the text in the revision history.
 */
export async function saveEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = EntryInput.safeParse(formObject(formData, ["countries"]));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { supabase, user } = session;
  const { id, countries, planned, ...fields } = parsed.data;

  const row = {
    ...fields,
    summary: fields.summary,
    region_slug: fields.region_slug ?? null,
    special_slug: fields.special_slug ?? null,
    cover_url: fields.cover_url ?? null,
    cover_credit: fields.cover_credit || null,
    author_name: fields.author_name || null,
    reading_minutes: fields.reading_minutes ?? null,
    body_html: sanitizeRichHtml(fields.body_html),
    author_id: fields.author_id ?? null,
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
    const { error } = await supabase
      .from("entries")
      .update({ ...update, status: nextStatus as "draft" | "planned" | "pending" | "published" })
      .eq("id", entryId);
    if (error) return failed(error);
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

  if (status === "published") refresh(row.slug, row.region_slug, row.special_slug);
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

/** Revalidates an article's cache by its placement (`onlyPublished`: only when it's live). */
async function refreshEntry(supabase: Client, id: string, onlyPublished = false) {
  const { data } = await supabase
    .from("entries")
    .select("slug, status, region_slug, special_slug")
    .eq("id", id)
    .maybeSingle();
  if (onlyPublished && data?.status !== "published") return;
  refresh(data?.slug, data?.region_slug, data?.special_slug);
}

type Client = NonNullable<Awaited<ReturnType<typeof signedIn>>>["supabase"];

/**
 * Entry chapters (P9) — the form sends each chapter's fields under the same
 * names in page order. All are saved at once in a single transaction
 * (DB `replace_entry_parts`); RLS decides who may, as for the article.
 */
export async function saveChapters(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const entryId = String(formData.get("entry_id") ?? "");
  if (!uuid.safeParse(entryId).success) return { ok: false, error: "Invalid entry." };
  const column = (name: string) => formData.getAll(name).map(String);
  const titles = column("title");
  const [points, bodies, illustrations, credits, audio] = [
    column("summary_points"),
    column("body_html"),
    column("illustration_url"),
    column("illustration_credit"),
    column("audio_url"),
  ];
  const parsed = z
    .array(ChapterInput)
    .max(MAX_CHAPTERS, `At most ${MAX_CHAPTERS} chapters.`)
    .safeParse(
      titles.map((title, index) => ({
        title,
        summary_points: points[index],
        body_html: bodies[index],
        illustration_url: illustrations[index],
        illustration_credit: credits[index],
        audio_url: audio[index],
      })),
    );
  if (!parsed.success) return listItemError(parsed.error, "Chapter", CHAPTER_FIELD_LABEL);

  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { error } = await session.supabase.rpc("replace_entry_parts", {
    p_entry: entryId,
    p_part: "chapters",
    p_items: parsed.data.map((chapter) => ({
      ...chapter,
      body_html: sanitizeRichHtml(chapter.body_html),
    })),
  });
  if (error) return failed(error);
  await refreshEntry(session.supabase, entryId, true);
  return { ok: true, message: "Chapters saved." };
}

/** Entry sources — same items as portrait sources, saved by the section editor. */
export async function saveEntryResources(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const entryId = String(formData.get("entry_id") ?? "");
  if (!uuid.safeParse(entryId).success) return { ok: false, error: "Invalid entry." };
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { ok: false, error: "Invalid section data." };
  }
  const parsed = z.array(COLLECTIONS.resources).max(50).safeParse(raw);
  if (!parsed.success) return listItemError(parsed.error, "Source", {});

  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { error } = await session.supabase.rpc("replace_entry_parts", {
    p_entry: entryId,
    p_part: "resources",
    p_items: parsed.data,
  });
  if (error) return failed(error);
  await refreshEntry(session.supabase, entryId, true);
  return { ok: true, message: "Sources saved." };
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
 * New language version of an article (G5.3): a DB function copies the original
 * as the caller's draft in the target language; it then goes through the same approval.
 */
export async function createTranslation(formData: FormData): Promise<void> {
  const entryId = String(formData.get("entry_id") ?? "");
  const locale = String(formData.get("locale") ?? "");
  if (!uuid.safeParse(entryId).success || !isLocale(locale) || locale === DEFAULT_LOCALE) {
    redirect("/admin/content");
  }
  const session = await signedIn();
  if (!session) redirect(`/login?next=/admin/content/${entryId}`);
  const { data, error } = await session.supabase.rpc("create_entry_translation", {
    p_entry: entryId,
    p_locale: locale,
  });
  if (error) redirect(`/admin/content/${entryId}?translation=error`);
  redirect(`/admin/content/${data}?saved=1`);
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
    .select("slug, status, region_slug, special_slug");
  if (error) return failed(error);
  if (!data.length)
    return {
      ok: false,
      error: "The article can't be deleted (no permission or it no longer exists).",
    };
  const [removed] = data;
  if (removed?.status === "published")
    refresh(removed.slug, removed.region_slug, removed.special_slug);
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
  const { data: updated, error: updateError } = await supabase
    .from("entries")
    .update({
      title: snapshot.title,
      summary: snapshot.summary,
      body_html: sanitizeRichHtml(snapshot.body_html),
      cover_url: snapshot.cover_url,
    })
    .eq("id", entryId)
    .select("slug, status, region_slug, special_slug")
    .single();
  if (updateError) return failed(updateError);
  if (updated.status === "published") {
    refresh(updated.slug, updated.region_slug, updated.special_slug);
  }
  return { ok: true, message: "Restored from history." };
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
