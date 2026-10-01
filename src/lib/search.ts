import "server-only";
import { getEntries } from "@/features/entries/queries";
import { getAtlas } from "@/features/geography/queries";
import { createPublicClient } from "@/lib/supabase/public";

type SearchKind = "region" | "country" | "issue" | "news";

export interface SearchHit {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  /** Úryvek pod výsledkem. */
  body: string;
  url: string;
  /** Kam otočit globus, když uživatel výsledek otevře. */
  center?: [number, number];
  zoom?: number;
  score: number;
}

/**
 * Fulltext nad celým Atlasem přes RPC `search()` v Postgresu (ADR-005):
 * index je vždy aktuální a sdílený všemi instancemi. Úryvek a střed mapy
 * se doplní z modelu, který už je v cache.
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
      url: row.url,
      score: row.rank,
    };
    if (row.kind === "region") {
      const region = atlas.regionBySlug.get(key);
      Object.assign(hit, { body: region?.summary, center: region?.center, zoom: region?.zoom });
    } else if (row.kind === "country") {
      const country = atlas.countryByIso3.get(key);
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
