import "server-only";
import { can } from "@/features/auth/access";
import type { Permissions } from "@/config/sections";
import { must, rowsOf } from "@/lib/db/result";
import { createServerClient } from "@/lib/supabase/server";
import type { Collection } from "./schema";

/**
 * Reading portraits for editing (under the user's session, no cache). Collection
 * items are returned in order and in the shape the editor sends them back.
 */

type Owner = { region: string } | { issue: string } | { country: string };

function ownerFilter(owner: Owner) {
  if ("region" in owner) return { region_slug: owner.region, special_slug: null };
  if ("issue" in owner) return { region_slug: null, special_slug: owner.issue };
  return { country_iso3: owner.country };
}

const SELECT: Record<Collection, string> = {
  faq: "question, answer",
  resources: "kind, title, source, description, url, image_url",
  metrics: "value, label, description, source, source_url, period",
};

const TABLE = {
  faq: "faq_items",
  resources: "resources",
  metrics: "portrait_metrics",
} as const;

type PortraitItems = Record<Collection, Record<string, string>[]>;

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
      const rows = rowsOf(
        await query.order("position"),
        `portrait: ${collection}`,
      ) as unknown as Record<string, unknown>[];
      // Forms work with strings; null → "".
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
  return must(
    await supabase
      .from("regions")
      .select(
        "slug, name, tagline, summary, intro, hero_url, hero_credit, fill, stroke, center_lon, center_lat, zoom, content_status",
      )
      .eq("slug", slug)
      .maybeSingle(),
    "regions",
  );
}

export async function issueForEdit(slug: string) {
  const supabase = await createServerClient();
  const data = must(
    await supabase
      .from("special_regions")
      .select(
        "slug, kind, name, subtitle, summary, intro, hero_url, hero_credit, fill, stroke, center_lon, center_lat, zoom, content_status, special_region_countries(country_iso3)",
      )
      .eq("slug", slug)
      .maybeSingle(),
    "issues",
  );
  if (!data) return null;
  const { special_region_countries, ...rest } = data;
  return { ...rest, countries: special_region_countries.map((row) => row.country_iso3) };
}

/** ISO3 codes of the countries whose profile text is written (the atlas snapshot leaves the text out). */
export async function countriesWithProfileText(): Promise<Set<string>> {
  const supabase = await createServerClient();
  const data = must(
    await supabase.from("countries").select("iso3").neq("profile_html", ""),
    "countries",
  );
  return new Set(data.map((row) => row.iso3));
}

export async function countryForEdit(slug: string) {
  const supabase = await createServerClient();
  return must(
    await supabase
      .from("countries")
      .select(
        "iso3, slug, name, name_formal, population, un_subregion, territory_note, region_slug, blurb, tagline, profile_html, featured_indicators",
      )
      .eq("slug", slug)
      .maybeSingle(),
    "countries",
  );
}

/**
 * What the signed-in user may save in a portrait — the same rules as RLS:
 * header = section regions/specials "e", section texts (timeline, FAQ, sources)
 * = article editors with scope over all articles, manual cards = regions "e"
 * (groups: specials "e"), maps & charts = either of the two (features/visuals).
 * A country's timeline follows its profile (regions "e"), see
 * features/timelines. The page shows the editor accordingly, or just a preview.
 */
export async function portraitRights(
  permissions: Permissions,
  kind: "region" | "issue" | "country",
) {
  const supabase = await createServerClient();
  const { data: allNews } = await supabase.rpc("can_edit_entry", {
    p_owner: null as unknown as string,
  });
  const head = can(permissions, kind === "issue" ? "specials" : "regions", "e");
  const text = can(permissions, "news", "e") && allNews === true;
  return {
    head,
    text,
    // Group metric cards are governed by the groups right (RLS portrait_metrics, migration 30).
    metrics: head,
    // can_edit_visual (migration 20261015000100): the place's editors or the texts' editors;
    // removing through the texts' right needs news "d".
    visuals: head || text,
    removeVisuals: head || (text && can(permissions, "news", "d")),
  };
}
