import "server-only";
import { must } from "@/lib/db/result";
import { createServerClient } from "@/lib/supabase/server";

/** Reading authors for editors — under the user's session, no cache. */

export interface AuthorRow {
  id: string;
  name: string;
  slug: string;
  photo_url: string | null;
  bio: string;
  positionality: string;
}

const COLUMNS = "id, name, slug, photo_url, bio, positionality";

export async function listAuthors(): Promise<AuthorRow[]> {
  const supabase = await createServerClient();
  return must(await supabase.from("authors").select(COLUMNS).order("name").limit(500), "authors");
}

export async function getAuthor(id: string): Promise<AuthorRow | null> {
  const supabase = await createServerClient();
  return must(await supabase.from("authors").select(COLUMNS).eq("id", id).maybeSingle(), "authors");
}

/**
 * The team account an author profile is linked to (null = none). Only for
 * account managers — the DB (author_account) refuses everyone else.
 */
export async function getAuthorAccount(id: string): Promise<string | null> {
  const supabase = await createServerClient();
  return must(await supabase.rpc("author_account", { p_author: id }), "authors");
}
