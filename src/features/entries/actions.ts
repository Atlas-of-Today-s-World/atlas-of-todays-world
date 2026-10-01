"use server";

import "server-only";
import { revalidateTag } from "next/cache";
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
import { uuid } from "@/lib/validation/common";
import { EntryInput, SendBackInput } from "./schema";

/** Po změně zveřejněného obsahu obnovit seznamy, detail i portréty. */
function refresh(slug?: string | null, region?: string | null, issue?: string | null) {
  revalidateTag(tags.entries);
  if (slug) revalidateTag(tags.entry(slug));
  if (region) revalidateTag(tags.portrait("region", region));
  if (issue) revalidateTag(tags.portrait("issue", issue));
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
  };

  let entryId = id;
  let status: string;
  if (entryId) {
    const { data: current, error: readError } = await supabase
      .from("entries")
      .select("status, slug")
      .eq("id", entryId)
      .single();
    if (readError) return failed(readError);
    // Zveřejněný článek nemění adresu — odkazy na něj už kolují.
    const update = current.status === "published" ? { ...row, slug: current.slug } : { ...row };
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
  if (!id) redirect(`/admin/obsah/${entryId}?ulozeno=1`);
  return { ok: true, message: "Uloženo.", id: entryId };
}

async function syncCountries(
  supabase: NonNullable<Awaited<ReturnType<typeof signedIn>>>["supabase"],
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
  submit_entry: "Odesláno ke schválení.",
  approve_entry: "Schváleno a zveřejněno.",
  unpublish_entry: "Staženo z webu, článek je znovu koncept.",
};

/** Přechod stavu jen přes RPC funkci v DB (ARCHITEKTURA 4.3) — nikdy přímý UPDATE. */
async function transition(fn: Transition, id: string): Promise<ActionState> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Neplatný článek." };
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { supabase } = session;
  const { error } = await supabase.rpc(fn, { p_entry: id });
  if (error) return failed(error);
  if (fn !== "submit_entry") {
    const { data } = await supabase
      .from("entries")
      .select("slug, region_slug, special_slug")
      .eq("id", id)
      .maybeSingle();
    refresh(data?.slug, data?.region_slug, data?.special_slug);
  }
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
  return { ok: true, message: "Vráceno autorovi s poznámkou." };
}

export async function deleteEntry(id: string): Promise<ActionState> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Neplatný článek." };
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase
    .from("entries")
    .delete()
    .eq("id", id)
    .select("slug, status, region_slug, special_slug");
  if (error) return failed(error);
  if (!data.length)
    return { ok: false, error: "Článek nejde smazat (nemáte právo nebo už neexistuje)." };
  if (data[0].status === "published")
    refresh(data[0].slug, data[0].region_slug, data[0].special_slug);
  return { ok: true, message: "Smazáno." };
}

/** Obnoví text z historie; současná podoba se tím sama uloží jako další revize. */
export async function restoreRevision(entryId: string, revisionId: number): Promise<ActionState> {
  if (!uuid.safeParse(entryId).success || !Number.isInteger(revisionId)) {
    return { ok: false, error: "Neplatná revize." };
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
  return { ok: true, message: "Obnoveno z historie." };
}
