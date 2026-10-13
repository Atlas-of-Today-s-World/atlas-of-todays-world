import "server-only";
import { selectHomeFeatured } from "@/features/topics/featured";
import { must } from "@/lib/db/result";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Home page — admin reads (layer: features/<domain>/editorial.ts, ARCHITEKTURA 4.1),
 * under the editor's session, no cache.
 */

/** The two pinned subtopic slots (null = the newest fills it). */
export async function homeFeaturedForEdit(): Promise<{
  first: string | null;
  second: string | null;
}> {
  const supabase = await createServerClient();
  const row = must(await selectHomeFeatured(supabase), "home featured");
  return { first: row?.first_chapter ?? null, second: row?.second_chapter ?? null };
}
