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
import { uuid } from "@/lib/validation/common";
import { COLLECTIONS } from "@/features/portraits/schema";
import {
  CHAPTER_FIELD_LABEL,
  ChapterInput,
  EntryInput,
  ScheduleInput,
  SendBackInput,
} from "./schema";
import { MAX_CHAPTERS, PREVIEW_HOURS } from "./constants";

/** Po změně zveřejněného obsahu obnovit seznamy, detail i portréty. */
function refresh(slug?: string | null, region?: string | null, issue?: string | null) {
  updateTag(tags.entries);
  if (slug) updateTag(tags.entry(slug));
  if (region) updateTag(tags.portrait("region", region));
  if (issue) updateTag(tags.portrait("issue", issue));
}

/**
 * Uložení novinky/hesla (ARCHITEKTURA 4.3). Nový článek vzniká jako koncept
 * autora; kdo smí co upravit, rozhoduje RLS + guard_entries. Předchozí podobu
 * textu si uloží trigger do historie revizí.
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
    // Zveřejněný článek nemění adresu — odkazy na něj už kolují. Překlad má
    // adresu i druh vždy po originálu (hlídá i trigger v DB).
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

/** Přechod stavu jen přes RPC funkci v DB (ARCHITEKTURA 4.3) — nikdy přímý UPDATE. */
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

/** Obnoví cache článku podle jeho zařazení (`onlyPublished`: jen když je na webu). */
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
 * Kapitoly hesla (P9) — formulář posílá pole každé kapitoly pod stejnými
 * jmény v pořadí na stránce. Uloží se všechny najednou v jedné transakci
 * (DB `replace_entry_parts`); kdo smí, rozhoduje RLS jako u článku.
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

/** Zdroje hesla — stejné položky jako zdroje portrétu, ukládá je editor sekcí. */
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
 * Naplánuje zveřejnění čekajícího článku (DB `schedule_entry` — smí jen ten,
 * kdo smí článek schválit). V daný čas ho zveřejní pg_cron; web se obnoví
 * nejpozději po PUBLIC_REVALIDATE_SECONDS, proto tady se cache nemaže.
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
 * Nová jazyková verze článku (G5.3): DB funkce zkopíruje originál jako
 * koncept volajícího v cílovém jazyce; dál jde stejným schvalováním.
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

/** Obnoví text z historie; současná podoba se tím sama uloží jako další revize. */
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
 * Sdílitelný odkaz na náhled článku (G2). Smí ho vytvořit jen ten, kdo článek
 * upravuje nebo schvaluje (rozhoduje create_preview_link). Token se vrací jen
 * teď, v databázi je pouze jeho hash.
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
