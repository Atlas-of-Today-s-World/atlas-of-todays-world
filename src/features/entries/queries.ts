import "server-only";
import { unstable_cache } from "next/cache";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import type { ArticleKind, NewsCategory } from "@/lib/content-types";
import { must } from "@/lib/db/result";
import { createPublicClient } from "@/lib/supabase/public";
import { MAP_LAYERS, PLANNED_STAGES, type MapLayer, type PlannedStage } from "./constants";
import { COLUMNS, type Row, toLocale, toSummary } from "./rows";
import type { AuthorArticle, EntrySummary, PlannedTopic, TopicPlace } from "./types";

/**
 * Public reads of published articles: the lists (entries, an author's
 * articles, planned entries, entry places). The entry page is in
 * `topic-queries.ts`, the preview by link in `preview-queries.ts`.
 */

/** Published originals of the given kind, newest first (language versions never list twice). */
function listPublished(kind: ArticleKind) {
  return unstable_cache(
    async (): Promise<EntrySummary[]> => {
      const data = must(
        await createPublicClient()
          .from("entries")
          .select(COLUMNS)
          .eq("status", "published")
          .eq("kind", kind)
          .is("translation_of", null)
          .order("published_on", { ascending: false, nullsFirst: false })
          .limit(1000),
        "entries",
      );
      return (data as Row[]).map((row) => toSummary(row, [toLocale(row.locale)]));
    },
    [kind === "news" ? "entries" : "encyclopedia"],
    { tags: [tags.entries], revalidate: PUBLIC_REVALIDATE_SECONDS },
  );
}

/** Published encyclopedia entries (originals), newest first. */
export const getEncyclopediaEntries = listPublished("entry");

/**
 * Cached per author (a new profile is a cache miss, not a stale list);
 * publishing revalidates `entries`.
 */
export function getArticlesByAuthor(authorSlug: string): Promise<AuthorArticle[]> {
  return unstable_cache(
    async () => {
      const data = must(
        await createPublicClient()
          .from("entries")
          .select("slug, kind, title, category, published_on, authors!inner(slug)")
          .eq("status", "published")
          .is("translation_of", null)
          .eq("authors.slug", authorSlug)
          .order("published_on", { ascending: false, nullsFirst: false })
          .limit(500),
        "entries",
      );
      return data.map((row) => ({
        kind: row.kind as ArticleKind,
        slug: row.slug,
        title: row.title,
        category: row.category as NewsCategory,
        published: row.published_on ?? undefined,
      }));
    },
    ["author-articles", authorSlug],
    { tags: [tags.entries], revalidate: PUBLIC_REVALIDATE_SECONDS },
  )();
}

/** Published topics with where they belong on the globe (the map's topic counts). */
export const getTopicPlaces = unstable_cache(
  async (): Promise<TopicPlace[]> => {
    const data = must(
      await createPublicClient()
        .from("entries")
        .select("slug, title, region_slug, special_slug, map_layers, entry_countries(country_iso3)")
        .eq("kind", "entry")
        .eq("status", "published")
        .is("translation_of", null),
      "topics",
    );
    return data.map((row) => ({
      slug: row.slug,
      title: row.title,
      region: row.region_slug,
      issue: row.special_slug,
      countries: row.entry_countries.map((country) => country.country_iso3),
      layers: row.map_layers.filter((layer): layer is MapLayer =>
        (MAP_LAYERS as readonly string[]).includes(layer),
      ),
    }));
  },
  ["topic-places"],
  { tags: [tags.entries], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

/**
 * Planned topics (originals): title, theme and place only — the DB function
 * `planned_entries()` gives anonymous readers nothing of their text.
 */
export const getPlannedTopics = unstable_cache(
  async (): Promise<PlannedTopic[]> => {
    const data = must(await createPublicClient().rpc("planned_entries"), "planned_entries");
    return data.map((row) => ({
      title: row.title,
      category: row.category as NewsCategory,
      stage: (PLANNED_STAGES as readonly string[]).includes(row.planned_stage)
        ? (row.planned_stage as PlannedStage)
        : "in_preparation",
      region: row.region_slug,
      issue: row.special_slug,
      countries: row.countries,
    }));
  },
  ["planned-topics"],
  { tags: [tags.entries], revalidate: PUBLIC_REVALIDATE_SECONDS },
);
