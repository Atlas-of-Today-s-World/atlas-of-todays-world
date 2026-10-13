import "server-only";
import { must } from "@/lib/db/result";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Custom map areas — admin reads (layer: features/<domain>/editorial.ts,
 * ARCHITEKTURA 4.1), under the user's session, no cache.
 */

/** One area for its edit form; null when it doesn't exist (a DB error throws, it is not a 404). */
export async function getArea(slug: string) {
  const supabase = await createServerClient();
  return must(
    await supabase
      .from("map_areas")
      .select("slug, name, label, note, fill, stroke, country_iso3, geometry")
      .eq("slug", slug)
      .maybeSingle(),
    "areas",
  );
}
