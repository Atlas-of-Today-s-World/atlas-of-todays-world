"use server";

import "server-only";
import { updateTag } from "next/cache";
import { failed, invalid, NOT_SIGNED_IN, signedIn, type ActionState } from "@/lib/actions";
import { tags } from "@/lib/cache/tags";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { TranslationInput } from "./schema";
import { HTML_FIELDS, TRANSLATABLE, type TranslatableEntity } from "./translatable";

/**
 * Uloží překlady polí jednoho celku (G5). Vyplněné pole = upsert, prázdné =
 * smazat (web pak ukáže angličtinu). Kdo smí, rozhoduje RLS podle sekce celku.
 */
export async function saveTranslations(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const fields: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (name.startsWith("field.")) fields[name.slice(6)] = String(value);
  }
  const parsed = TranslationInput.safeParse({
    entity: formData.get("entity"),
    key: formData.get("key"),
    locale: formData.get("locale"),
    fields,
  });
  if (!parsed.success) return invalid(parsed.error);
  const session = await signedIn();
  if (!session) return NOT_SIGNED_IN;
  const { entity, key, locale } = parsed.data;
  const allowed: readonly string[] = TRANSLATABLE[entity as TranslatableEntity];

  const upserts = [];
  const removals = [];
  for (const [field, raw] of Object.entries(parsed.data.fields)) {
    if (!allowed.includes(field)) continue;
    const value = HTML_FIELDS.has(field) ? sanitizeRichHtml(raw).trim() : raw.trim();
    if (value) upserts.push({ entity, entity_key: key, field, locale, value });
    else removals.push(field);
  }

  const { supabase } = session;
  if (upserts.length) {
    const { error } = await supabase.from("translations").upsert(upserts);
    if (error) return failed(error);
  }
  if (removals.length) {
    const { error } = await supabase
      .from("translations")
      .delete()
      .eq("entity", entity)
      .eq("entity_key", key)
      .eq("locale", locale)
      .in("field", removals);
    if (error) return failed(error);
  }
  // Překlady jsou součástí snímku Atlasu v daném jazyce.
  updateTag(tags.atlas);
  return { ok: true, message: "Translation saved." };
}
