import "server-only";
import { createServerClient } from "@/lib/supabase/server";

/** Čtení autorů pro redakci — pod session uživatele, bez cache. */

export interface AuthorRow {
  id: string;
  name: string;
  photo_url: string | null;
  bio: string;
  positionality: string;
}

const COLUMNS = "id, name, photo_url, bio, positionality";

export async function listAuthors(): Promise<AuthorRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("authors").select(COLUMNS).order("name").limit(500);
  if (error) throw new Error(`[authors] ${error.message}`);
  return data;
}

export async function getAuthor(id: string): Promise<AuthorRow | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("authors").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`[authors] ${error.message}`);
  return data;
}
