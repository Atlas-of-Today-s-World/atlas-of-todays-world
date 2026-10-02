import "server-only";
import { unstable_cache } from "next/cache";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { createPublicClient } from "@/lib/supabase/public";

/** Public author profile (/authors/<slug>) — the byline's page (G8, E-E-A-T). */
export interface PublicAuthor {
  slug: string;
  name: string;
  photo?: string;
  bio: string;
  positionality: string;
}

interface AuthorRow {
  slug: string;
  name: string;
  photo_url: string | null;
  bio: string;
  positionality: string;
}

const toAuthor = (row: AuthorRow): PublicAuthor => ({
  slug: row.slug,
  name: row.name,
  photo: row.photo_url ?? undefined,
  bio: row.bio,
  positionality: row.positionality,
});

/**
 * All author profiles, by name. Anon reads only the public columns (DB-08);
 * saving an author revalidates `entries`, which is the tag here too.
 */
export const getAuthors = unstable_cache(
  async (): Promise<PublicAuthor[]> => {
    const { data, error } = await createPublicClient()
      .from("authors")
      .select("slug, name, photo_url, bio, positionality")
      .order("name")
      .limit(1000);
    if (error) throw new Error(`[authors] ${error.message}`);
    return data.map(toAuthor);
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
      const { data, error } = await createPublicClient()
        .from("authors")
        .select("slug, name, photo_url, bio, positionality")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new Error(`[authors] ${error.message}`);
      return data ? toAuthor(data) : null;
    },
    ["author", slug],
    { tags: [tags.entries], revalidate: PUBLIC_REVALIDATE_SECONDS },
  )();
}
