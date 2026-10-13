import "server-only";
import { unstable_cache } from "next/cache";
import { clampFeaturedCount } from "@/features/home/config";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { must } from "@/lib/db/result";
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
    const data = must(
      await createPublicClient()
        .from("entries")
        // Anon may read only listed columns (DB-08).
        .select(
          "slug, title, entry_chapters(id, position, title, illustration_url, tile_background, created_at)",
        )
        .eq("status", "published")
        .eq("kind", "entry")
        .is("translation_of", null)
        .limit(1000),
      "subtopics",
    );
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

/** The home map as set in the admin: pinned subtopic ids in order, how many tiles. */
interface HomeFeatured {
  pins: string[];
  count: number;
}

const getHomeFeatured = unstable_cache(
  async (): Promise<HomeFeatured> => {
    const client = createPublicClient();
    const [items, settings] = await Promise.all([
      client
        .from("home_featured_items")
        .select("chapter_id")
        .order("position")
        .order("id")
        .limit(100),
      client.from("home_settings").select("featured_count").eq("id", 1).maybeSingle(),
    ]);
    // The pins are a nicety: without them (e.g. before the migration) the newest show.
    const error = items.error ?? settings.error;
    if (error) console.error(`[home featured] ${error.message}`);
    return {
      pins: (items.data ?? []).map((row) => row.chapter_id),
      count: clampFeaturedCount(settings.data?.featured_count),
    };
  },
  ["home-featured-items"],
  { tags: [tags.home], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

/**
 * The subtopics on the home map: the ones pinned in the admin first, in their
 * order (an unpublished pin is skipped), then the newest subtopics not shown
 * yet — each from a topic not shown yet when there is one, so the tiles aren't
 * one topic twice — until there are `count` tiles (or no subtopics left).
 */
export function pickFeatured(
  tiles: readonly SubtopicTile[],
  pins: readonly string[],
  count: number,
): SubtopicTile[] {
  const byId = new Map(tiles.map((tile) => [tile.id, tile]));
  const shown: SubtopicTile[] = [];
  const ids = new Set<string>();
  const topics = new Set<string>();
  const add = (tile: SubtopicTile) => {
    shown.push(tile);
    ids.add(tile.id);
    topics.add(tile.topicSlug);
  };
  for (const id of pins) {
    if (shown.length >= count) return shown;
    const tile = byId.get(id);
    if (tile && !ids.has(tile.id)) add(tile);
  }
  while (shown.length < count) {
    const fresh = tiles.filter((tile) => !ids.has(tile.id));
    const pick = fresh.find((tile) => !topics.has(tile.topicSlug)) ?? fresh[0];
    if (!pick) break;
    add(pick);
  }
  return shown;
}

export async function featuredSubtopics(): Promise<SubtopicTile[]> {
  const [tiles, { pins, count }] = await Promise.all([getSubtopicTiles(), getHomeFeatured()]);
  return pickFeatured(tiles, pins, count);
}
