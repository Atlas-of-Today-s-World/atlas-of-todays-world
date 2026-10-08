import "server-only";
import { getEntries } from "@/features/entries/queries";
import { getAtlas } from "@/features/geography/queries";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Site search (header search, /search, /api/search): one Postgres RPC over
 * places and articles, ranked in the database; hits are filled in here with
 * summaries and map centres from the already cached atlas model.
 */

type SearchKind = "region" | "country" | "issue" | "news";

/** How often one address may search; the /search page and /api/search share the limit. */
export const SEARCH_LIMIT = { limit: 60, windowSeconds: 60 };

export interface SearchHit {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  /** Snippet below the result. */
  body: string;
  url: string;
  /** Where to rotate the globe when the user opens the result. */
  center?: [number, number];
  zoom?: number;
  score: number;
}

/**
 * Full-text search across the whole Atlas via the Postgres RPC `search()` (ADR-005):
 * the index is always current and shared by all instances. The snippet and map
 * center are filled in from the model, which is already cached.
 */
export async function search(query: string, limit = 12): Promise<SearchHit[]> {
  const trimmed = query.trim().slice(0, 200);
  if (!trimmed) return [];

  const [{ data, error }, atlas, entries] = await Promise.all([
    createPublicClient().rpc("search", { p_text: trimmed, p_limit: limit }),
    getAtlas(),
    getEntries(),
  ]);
  if (error) throw new Error(`[search] ${error.message}`);
  const entryBySlug = new Map(entries.map((entry) => [entry.slug, entry]));

  return (data ?? []).map((row) => {
    const key = row.id.split(":")[1] ?? "";
    const hit: SearchHit = {
      id: row.id,
      kind: row.kind as SearchKind,
      title: row.title,
      subtitle: row.subtitle,
      body: "",
      // Topics moved from /entry/ to /topics/ (the old path only redirects).
      url: row.url.replace(/^\/entry\//, "/topics/"),
      score: row.rank,
    };
    if (row.kind === "region") {
      const region = atlas.regionBySlug.get(key);
      Object.assign(hit, { body: region?.summary, center: region?.center, zoom: region?.zoom });
    } else if (row.kind === "country") {
      const country = atlas.countryByIso3.get(key);
      // The full name, as in the country's heading ("Democratic Republic of the
      // Congo", not the map label "Dem. Rep. Congo" the database returns).
      if (country) hit.title = country.name;
      if (country?.labelLon != null && country.labelLat != null) {
        hit.center = [country.labelLon, country.labelLat];
        hit.zoom = 3.4;
      }
      hit.body = country?.profile.summary || country?.nameFormal || "";
    } else if (row.kind === "issue") {
      const issue = atlas.issueBySlug.get(key);
      Object.assign(hit, { body: issue?.summary, center: issue?.center, zoom: issue?.zoom });
    } else {
      const entry = entryBySlug.get(key);
      const region = entry?.region ? atlas.regionBySlug.get(entry.region) : undefined;
      Object.assign(hit, {
        body: entry?.summary,
        subtitle: [row.subtitle, region?.name].filter(Boolean).join(" · "),
        center: region?.center,
        zoom: region?.zoom,
      });
    }
    hit.body = (hit.body ?? "").slice(0, 400);
    return hit;
  });
}
