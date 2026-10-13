import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { markHits, queryWords, type TopicHit } from "./text-search";

/**
 * Full-text search inside the published topics (intro and chapters) via the
 * Postgres RPC `search_topics()`: matched, ranked and excerpted in the database
 * (GIN indexes), so no request loads the text of every topic. The excerpt
 * comes back as plain text; the hits are marked here and rendered as text.
 */
export async function searchTopics(query: string, limit = 30): Promise<TopicHit[]> {
  const words = queryWords(query);
  if (!words.length) return [];

  const { data, error } = await createPublicClient().rpc("search_topics", {
    p_text: query,
    p_limit: limit,
  });
  if (error) throw new Error(`[topics] ${error.message}`);
  return (data ?? []).map((row) => ({
    slug: row.slug,
    topicTitle: row.topic_title,
    heading: row.heading,
    anchor: row.anchor,
    excerpt: markHits(row.snippet, words),
    score: row.rank,
  }));
}
