import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { Collection } from "./schema";

/**
 * Čtení portrétů pro úpravy (pod session uživatele, bez cache). Položky
 * kolekcí se vrací v pořadí a v tvaru, v jakém je editor pošle zpátky.
 */

type Owner = { region: string } | { issue: string } | { country: string };

function ownerFilter(owner: Owner) {
  if ("region" in owner) return { region_slug: owner.region, special_slug: null };
  if ("issue" in owner) return { region_slug: null, special_slug: owner.issue };
  return { country_iso3: owner.country };
}

const SELECT: Record<Collection, string> = {
  timeline: "date_label, title, body, image_url",
  faq: "question, answer",
  resources: "kind, title, source, description, url, image_url",
  visuals: "provider, title, caption, url",
  metrics: "value, label, description, source, source_url, period",
};

const TABLE = {
  timeline: "timeline_events",
  faq: "faq_items",
  resources: "resources",
  visuals: "visual_embeds",
  metrics: "portrait_metrics",
} as const;

export type PortraitItems = Record<Collection, Record<string, string>[]>;

export async function portraitItems(owner: Owner, collections: Collection[]) {
  const supabase = await createServerClient();
  const filter = ownerFilter(owner);
  const results = await Promise.all(
    collections.map(async (collection) => {
      let query = supabase.from(TABLE[collection]).select(SELECT[collection]);
      for (const [column, value] of Object.entries(filter)) {
        query = value === null ? query.is(column, null) : query.eq(column, value);
      }
      if (collection === "resources") query = query.is("entry_id", null);
      const { data, error } = await query.order("position");
      if (error) throw new Error(`[portrait] ${collection}: ${error.message}`);
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      // Formuláře pracují s řetězci; null → "".
      return [
        collection,
        rows.map((row) =>
          Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v == null ? "" : String(v)])),
        ),
      ] as const;
    }),
  );
  return Object.fromEntries(results) as Partial<PortraitItems>;
}

export async function regionForEdit(slug: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("regions")
    .select(
      "slug, name, tagline, summary, intro, hero_url, hero_credit, fill, stroke, timeline_title, timeline_subtitle",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`[regions] ${error.message}`);
  return data;
}

export async function issueForEdit(slug: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("special_regions")
    .select(
      "slug, name, subtitle, summary, intro, hero_url, hero_credit, fill, stroke, center_lon, center_lat, zoom, timeline_title, timeline_subtitle, special_region_countries(country_iso3)",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`[issues] ${error.message}`);
  if (!data) return null;
  const { special_region_countries, ...rest } = data;
  return { ...rest, countries: special_region_countries.map((row) => row.country_iso3) };
}

export async function countryForEdit(slug: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("countries")
    .select("iso3, slug, name, region_slug, blurb, tagline, profile_html, featured_indicators")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`[countries] ${error.message}`);
  return data;
}
