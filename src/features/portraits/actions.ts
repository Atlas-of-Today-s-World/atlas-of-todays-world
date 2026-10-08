"use server";

import "server-only";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  failed,
  formObject,
  invalid,
  NOT_SIGNED_IN,
  signedIn,
  type ActionState,
  listItemError,
} from "@/lib/actions";
import { tags } from "@/lib/cache/tags";
import { notifyIndexNow } from "@/lib/seo/indexnow";
import { previewNote, storePreviewImages } from "@/lib/previews/store";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { slug as slugSchema } from "@/lib/validation/common";
import { COLLECTIONS, CountryInput, IssueInput, PortraitKind, RegionInput } from "./schema";

const FIELD_LABEL: Record<string, string> = {
  date_label: "date",
  title: "title",
  body: "text",
  question: "question",
  answer: "answer",
  kind: "type",
  url: "URL",
  image_url: "image",
  source: "source",
  source_url: "source link",
  value: "value",
  label: "label",
  provider: "type",
  caption: "caption",
  description: "description",
  period: "period",
};

/** After a portrait change: its section and, for countries/headers, the map snapshot too. */
function refresh(kind: PortraitKind, slug: string) {
  if (kind === "country") updateTag(tags.atlas);
  else updateTag(tags.portrait(kind, slug));
}

/**
 * Saves a whole portrait section (timeline, FAQ, sources, visuals, cards)
 * with a single call to the DB function `replace_portrait_items` — in one transaction.
 */
export async function savePortraitSection(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const head = z
    .object({
      kind: PortraitKind,
      slug: z.string().regex(/^([a-z0-9]+(-[a-z0-9]+)*|[A-Z]{3})$/),
      collection: z.enum(Object.keys(COLLECTIONS) as [keyof typeof COLLECTIONS]),
    })
    .safeParse(formObject(formData));
  if (!head.success) return { ok: false, error: "Invalid portrait section." };
  const { kind, slug, collection } = head.data;

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { ok: false, error: "Invalid section data." };
  }
  const items = z.array(COLLECTIONS[collection]).max(50).safeParse(raw);
  if (!items.success) return listItemError(items.error, "Item", FIELD_LABEL);

  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { error } = await session.supabase.rpc("replace_portrait_items", {
    p_kind: kind,
    p_slug: slug,
    p_collection: collection,
    p_items: items.data,
  });
  if (error) return failed(error);
  // Links of a region or global issue without an image get their page's preview.
  const previews =
    collection === "resources" && kind !== "country"
      ? await storePreviewImages(
          session.supabase,
          { column: kind === "region" ? "region_slug" : "special_slug", value: slug },
          items.data as { url: string; image_url?: string }[],
        )
      : {};
  refresh(kind, slug);
  return { ok: true, message: `Section saved.${previewNote(previews)}`, previews };
}

export async function saveRegion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = RegionInput.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { slug, ...fields } = parsed.data;
  const { data, error } = await session.supabase
    .from("regions")
    .update({
      ...fields,
      hero_url: fields.hero_url ?? null,
      timeline_title: fields.timeline_title || null,
      timeline_subtitle: fields.timeline_subtitle || null,
    })
    .eq("slug", slug)
    .select("slug");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "You can't edit this region." };
  updateTag(tags.atlas);
  updateTag(tags.portrait("region", slug));
  notifyIndexNow([`/region/${slug}`], { everyLanguage: true });
  return { ok: true, message: "Region saved." };
}

export async function saveIssue(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = IssueInput.safeParse(formObject(formData, ["countries"]));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { supabase } = session;
  const { original_slug, countries, ...fields } = parsed.data;
  const row = {
    ...fields,
    hero_url: fields.hero_url ?? null,
    timeline_title: fields.timeline_title || null,
    timeline_subtitle: fields.timeline_subtitle || null,
  };

  if (original_slug) {
    // An update RLS filters out is no error — only the rows it returns prove the write.
    const { data, error } = await supabase
      .from("special_regions")
      .update(row)
      .eq("slug", original_slug)
      .select("slug");
    if (error) return failed(error);
    if (!data.length) return { ok: false, error: "You can't edit this global issue." };
  } else {
    // An insert RLS refuses fails with an error.
    const { error } = await supabase.from("special_regions").insert(row);
    if (error) return failed(error);
  }

  // The unit's countries: diff against the current state (the foreign key renames itself).
  const { data: current, error: readError } = await supabase
    .from("special_region_countries")
    .select("country_iso3")
    .eq("special_slug", fields.slug);
  if (readError) return failed(readError);
  const have = new Set(current.map((c) => c.country_iso3));
  const want = new Set(countries);
  const remove = [...have].filter((iso3) => !want.has(iso3));
  const add = [...want].filter((iso3) => !have.has(iso3));
  if (remove.length) {
    const { error: removeError } = await supabase
      .from("special_region_countries")
      .delete()
      .eq("special_slug", fields.slug)
      .in("country_iso3", remove);
    if (removeError) return failed(removeError);
  }
  if (add.length) {
    const { error: addError } = await supabase
      .from("special_region_countries")
      .insert(add.map((country_iso3) => ({ special_slug: fields.slug, country_iso3 })));
    if (addError) return failed(addError);
  }

  updateTag(tags.atlas);
  updateTag(tags.portrait("issue", fields.slug));
  updateTag(tags.entries);
  notifyIndexNow([`/global-issue/${fields.slug}`], { everyLanguage: true });
  if (!original_slug || original_slug !== fields.slug) {
    redirect(`/admin/global-issues/${fields.slug}`);
  }
  return { ok: true, message: "Special region saved." };
}

export async function deleteIssue(slug: string): Promise<ActionState> {
  if (!slugSchema(120).safeParse(slug).success)
    return { ok: false, error: "Invalid global issue." };
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase
    .from("special_regions")
    .delete()
    .eq("slug", slug)
    .select("slug");
  if (error) return failed(error);
  if (!data.length)
    return { ok: false, error: "Can't delete this global issue (you don't have permission)." };
  updateTag(tags.atlas);
  updateTag(tags.entries);
  return { ok: true, message: "Deleted." };
}

export async function saveCountry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = CountryInput.safeParse(formObject(formData, ["featured_indicators"]));
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { iso3, ...fields } = parsed.data;
  const { data, error } = await session.supabase
    .from("countries")
    .update({
      ...fields,
      blurb: fields.blurb || null,
      region_slug: fields.region_slug ?? null,
      profile_html: sanitizeRichHtml(fields.profile_html),
    })
    .eq("iso3", iso3)
    .select("iso3, slug");
  if (error) return failed(error);
  const [country] = data;
  if (!country) return { ok: false, error: "You can't edit this country." };
  updateTag(tags.atlas);
  notifyIndexNow([`/country/${country.slug}`], { everyLanguage: true });
  return { ok: true, message: "Country profile saved." };
}
