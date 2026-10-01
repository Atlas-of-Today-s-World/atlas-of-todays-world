import "server-only";
import { unstable_cache } from "next/cache";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { createPublicClient } from "@/lib/supabase/public";

export interface Flags {
  maintenance: boolean;
  newsletter: boolean;
}

const DEFAULTS: Flags = { maintenance: false, newsletter: true };

/**
 * Přepínače funkcí (feature_flags, F6) — v cache s tagem, přepnutí v
 * administraci je hned obnoví. Když DB neodpoví, platí výchozí hodnoty:
 * výpadek tabulky nesmí sám vypnout web do údržby.
 */
export const getFlags = unstable_cache(
  async (): Promise<Flags> => {
    const { data, error } = await createPublicClient().from("feature_flags").select("key, enabled");
    if (error) {
      console.error("[flags]", error.message);
      return DEFAULTS;
    }
    const map = new Map(data.map((row) => [row.key, row.enabled]));
    return {
      maintenance: map.get("maintenance") ?? DEFAULTS.maintenance,
      newsletter: map.get("newsletter") ?? DEFAULTS.newsletter,
    };
  },
  ["feature-flags"],
  { tags: [tags.flags], revalidate: PUBLIC_REVALIDATE_SECONDS },
);
