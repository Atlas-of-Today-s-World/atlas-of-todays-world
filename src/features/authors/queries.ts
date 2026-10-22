import "server-only";
import { unstable_cache } from "next/cache";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { must } from "@/lib/db/result";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { createPublicClient } from "@/lib/supabase/public";

/** The author columns anon may read (DB-08) — the profile page and a topic's byline. */
export const PUBLIC_AUTHOR_COLUMNS = "slug, name, photo_url, bio, positionality, works_html";

/** Public author profile (/authors/<slug>) — the byline's page (G8, E-E-A-T). */
export interface PublicAuthor {
  slug: string;
  name: string;
  photo?: string;
  bio: string;
  positionality: string;
  /** Sanitized HTML of the selected works; "" = none. */
  worksHtml: string;
}

interface AuthorRow {
  slug: string;
  name: string;
  photo_url: string | null;
  bio: string;
  positionality: string;
  works_html: string;
}

const toAuthor = (row: AuthorRow): PublicAuthor => ({
  slug: row.slug,
  name: row.name,
  photo: row.photo_url ?? undefined,
  bio: row.bio,
  positionality: row.positionality,
  worksHtml: sanitizeRichHtml(row.works_html),
});

/**
 * All author profiles, by name. Anon reads only the public columns (DB-08);
 * saving an author revalidates `entries`, which is the tag here too.
 */
export const getAuthors = unstable_cache(
  async (): Promise<PublicAuthor[]> => {
    const rows = must(
      await createPublicClient()
        .from("authors")
        .select(PUBLIC_AUTHOR_COLUMNS)
        .order("name")
        .limit(1000),
      "authors",
    );
    return rows.map(toAuthor);
  },
  ["authors"],
  { tags: [tags.entries], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

/**
 * One profile by its slug, cached per slug: a profile created after the last
 * build is a cache miss and shows at once (creating an author revalidates no tag).
 */
export function getAuthorBySlug(slug: string): Promise<PublicAuthor | null> {
  return unstable_cache(
    async () => {
      const row = must(
        await createPublicClient()
          .from("authors")
          .select(PUBLIC_AUTHOR_COLUMNS)
          .eq("slug", slug)
          .maybeSingle(),
        "authors",
      );
      return row ? toAuthor(row) : null;
    },
    ["author", slug],
    { tags: [tags.entries], revalidate: PUBLIC_REVALIDATE_SECONDS },
  )();
}
