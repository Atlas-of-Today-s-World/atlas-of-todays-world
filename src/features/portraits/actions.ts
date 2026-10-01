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
} from "@/lib/actions";
import { tags } from "@/lib/cache/tags";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { slug as slugSchema } from "@/lib/validation/common";
import { COLLECTIONS, CountryInput, IssueInput, PortraitKind, RegionInput } from "./schema";

const FIELD_LABEL: Record<string, string> = {
  date_label: "datum",
  title: "název",
  body: "text",
  question: "otázka",
  answer: "odpověď",
  kind: "druh",
  url: "adresa",
  image_url: "obrázek",
  source: "zdroj",
  source_url: "odkaz na zdroj",
  value: "hodnota",
  label: "popisek",
  provider: "typ",
  caption: "popisek",
  description: "popis",
  period: "období",
};

/** Po změně portrétu: jeho sekce a u zemí/hlaviček i snapshot mapy. */
function refresh(kind: PortraitKind, slug: string) {
  if (kind === "country") updateTag(tags.atlas);
  else updateTag(tags.portrait(kind, slug));
}

/**
 * Uloží celou sekci portrétu (časovou osu, FAQ, zdroje, vizuály, karty)
 * jedním voláním DB funkce `replace_portrait_items` — v jedné transakci.
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
  if (!head.success) return { ok: false, error: "Neplatná sekce portrétu." };
  const { kind, slug, collection } = head.data;

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { ok: false, error: "Neplatná data sekce." };
  }
  const items = z.array(COLLECTIONS[collection]).max(50).safeParse(raw);
  if (!items.success) {
    const issue = items.error.issues[0];
    const [index, field] = issue.path;
    return {
      ok: false,
      error:
        typeof index === "number"
          ? `Položka ${index + 1}, ${FIELD_LABEL[String(field)] ?? field}: ${issue.message}`
          : issue.message,
    };
  }

  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { error } = await session.supabase.rpc("replace_portrait_items", {
    p_kind: kind,
    p_slug: slug,
    p_collection: collection,
    p_items: items.data,
  });
  if (error) return failed(error);
  refresh(kind, slug);
  return { ok: true, message: "Sekce uložena." };
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
  if (!data.length) return { ok: false, error: "Region nemůžete upravit." };
  updateTag(tags.atlas);
  updateTag(tags.portrait("region", slug));
  return { ok: true, message: "Region uložen." };
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

  const { error } = original_slug
    ? await supabase.from("special_regions").update(row).eq("slug", original_slug)
    : await supabase.from("special_regions").insert(row);
  if (error) return failed(error);

  // Země celku: rozdíl proti současnému stavu (cizí klíč se přejmenuje sám).
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
  if (!original_slug || original_slug !== fields.slug) {
    redirect(`/admin/global-issues/${fields.slug}`);
  }
  return { ok: true, message: "Global issue uložen." };
}

export async function deleteIssue(slug: string): Promise<ActionState> {
  if (!slugSchema(120).safeParse(slug).success) return { ok: false, error: "Neplatný celek." };
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { data, error } = await session.supabase
    .from("special_regions")
    .delete()
    .eq("slug", slug)
    .select("slug");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "Celek nejde smazat (nemáte právo)." };
  updateTag(tags.atlas);
  updateTag(tags.entries);
  return { ok: true, message: "Smazáno." };
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
    .select("iso3");
  if (error) return failed(error);
  if (!data.length) return { ok: false, error: "Zemi nemůžete upravit." };
  updateTag(tags.atlas);
  return { ok: true, message: "Profil země uložen." };
}
