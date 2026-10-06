import "server-only";
import { unstable_cache } from "next/cache";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { createPublicClient } from "@/lib/supabase/public";

/** A subtopic as a tile: its topic, title, photo (or colour) and anchor on the topic page. */
export interface SubtopicTile {
  id: string;
  topicSlug: string;
  topicTitle: string;
  title: string;
  image?: string;
  background?: string;
  /** `topic-2` — the subtopic's place on its topic page. */
  anchor: string;
  createdAt: string;
}

interface Row {
  slug: string;
  title: string;
  entry_chapters:
    | {
        id: string;
        position: number;
        title: string;
        illustration_url: string | null;
        tile_background: string | null;
        created_at: string;
      }[]
    | null;
}

/** Every subtopic of the published topics, newest first. */
export const getSubtopicTiles = unstable_cache(
  async (): Promise<SubtopicTile[]> => {
    const { data, error } = await createPublicClient()
      .from("entries")
      // Anon may read only listed columns (DB-08).
      .select(
        "slug, title, entry_chapters(id, position, title, illustration_url, tile_background, created_at)",
      )
      .eq("status", "published")
      .eq("kind", "entry")
      .is("translation_of", null)
      .limit(1000);
    if (error) throw new Error(`[subtopics] ${error.message}`);
    return (data as Row[])
      .flatMap((topic) =>
        [...(topic.entry_chapters ?? [])]
          .sort((a, b) => a.position - b.position)
          .map((chapter, index) => ({
            id: chapter.id,
            topicSlug: topic.slug,
            topicTitle: topic.title,
            title: chapter.title,
            image: chapter.illustration_url ?? undefined,
            background: chapter.tile_background ?? undefined,
            anchor: `topic-${index + 1}`,
            createdAt: chapter.created_at,
          })),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  ["subtopic-tiles"],
  { tags: [tags.entries], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

/** The two slots on the home map as set in the admin (null = newest). */
const getHomeFeatured = unstable_cache(
  async (): Promise<[string | null, string | null]> => {
    const { data, error } = await createPublicClient()
      .from("home_featured")
      .select("first_chapter, second_chapter")
      .eq("id", 1)
      .maybeSingle();
    // The pins are a nicety: without them (e.g. before the migration) the newest show.
    if (error) {
      console.error(`[home featured] ${error.message}`);
      return [null, null];
    }
    return [data?.first_chapter ?? null, data?.second_chapter ?? null];
  },
  ["home-featured"],
  { tags: [tags.entries], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

/**
 * The two subtopics on the home map: the ones pinned in the admin, each empty
 * (or unpublished) slot filled with the newest subtopic not shown yet — from a
 * topic not shown yet when there is one, so the two tiles aren't one topic twice.
 */
export function pickFeatured(
  tiles: readonly SubtopicTile[],
  pins: readonly (string | null)[],
): SubtopicTile[] {
  const byId = new Map(tiles.map((tile) => [tile.id, tile]));
  const chosen = pins.map((id) => (id ? byId.get(id) : undefined));
  const shown = chosen.filter((tile): tile is SubtopicTile => Boolean(tile));
  const next = () => {
    const fresh = tiles.filter((tile) => !shown.some((other) => other.id === tile.id));
    const pick =
      fresh.find((tile) => !shown.some((other) => other.topicSlug === tile.topicSlug)) ?? fresh[0];
    if (pick) shown.push(pick);
    return pick;
  };
  return chosen.map((tile) => tile ?? next()).filter((tile): tile is SubtopicTile => Boolean(tile));
}

export async function featuredSubtopics(): Promise<SubtopicTile[]> {
  const [tiles, pins] = await Promise.all([getSubtopicTiles(), getHomeFeatured()]);
  return pickFeatured(tiles, pins);
}
