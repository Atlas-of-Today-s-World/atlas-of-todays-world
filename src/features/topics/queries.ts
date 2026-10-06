import "server-only";
import { unstable_cache } from "next/cache";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { createPublicClient } from "@/lib/supabase/public";
import { htmlToText, type TopicText } from "./text-search";

interface Row {
  slug: string;
  title: string;
  summary: string | null;
  body_html: string | null;
  entry_chapters: { position: number; title: string; body_html: string | null }[] | null;
}

/**
 * Plain text of every published topic for the Topics search: the introduction
 * (summary + intro) and each chapter, in page order (chapter i = `#topic-i`).
 * Cached with the entries tag, so publishing in the admin refreshes it.
 */
export const getTopicTexts = unstable_cache(
  async (): Promise<TopicText[]> => {
    const { data, error } = await createPublicClient()
      .from("entries")
      // Anon may read only listed columns (DB-08).
      .select("slug, title, summary, body_html, entry_chapters(position, title, body_html)")
      .eq("status", "published")
      .eq("kind", "entry")
      .is("translation_of", null)
      .limit(1000);
    if (error) throw new Error(`[topics] ${error.message}`);
    return (data as Row[]).map((row) => ({
      slug: row.slug,
      title: row.title,
      parts: [
        {
          anchor: null,
          heading: row.title,
          text: [row.summary ?? "", htmlToText(row.body_html ?? "")].filter(Boolean).join(" "),
        },
        ...[...(row.entry_chapters ?? [])]
          .sort((a, b) => a.position - b.position)
          .map((chapter, index) => ({
            anchor: `topic-${index + 1}`,
            heading: chapter.title,
            text: htmlToText(chapter.body_html ?? ""),
          })),
      ],
    }));
  },
  ["topic-texts"],
  { tags: [tags.entries], revalidate: PUBLIC_REVALIDATE_SECONDS },
);
