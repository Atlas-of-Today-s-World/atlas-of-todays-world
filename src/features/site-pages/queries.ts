import "server-only";
import { unstable_cache } from "next/cache";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { createPublicClient } from "@/lib/supabase/public";
import { pageOrDefault, type PublishedRow } from "./defaults";
import type { SitePageContent, SitePageSlug } from "./pages";

/** Columns the public site reads (anon has no grant on the others). */
const COLUMNS = "title, description, lead, body_html, last_reviewed, published";

/**
 * One site page for the public website — cached per page (`page:<slug>`),
 * refreshed by the admin's save. A database outage never breaks the page:
 * the built-in text is shown instead (and not cached, so the next request
 * tries the database again).
 */
export async function getSitePage(slug: SitePageSlug): Promise<SitePageContent> {
  let row: PublishedRow | null = null;
  try {
    row = await unstable_cache(
      async (): Promise<PublishedRow | null> => {
        const { data, error } = await createPublicClient()
          .from("site_pages")
          .select(COLUMNS)
          .eq("slug", slug)
          .eq("published", true)
          .maybeSingle();
        if (error) throw new Error(error.message);
        return data;
      },
      ["site-page", slug],
      { tags: [tags.sitePage(slug)], revalidate: PUBLIC_REVALIDATE_SECONDS },
    )();
  } catch (failure) {
    console.error("[site-pages]", slug, (failure as Error).message);
  }
  return pageOrDefault(slug, row);
}
