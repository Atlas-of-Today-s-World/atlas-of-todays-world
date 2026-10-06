import "server-only";
import { unstable_cache } from "next/cache";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Feature flags — public read (layer: features/<domain>/queries.ts). Cached under the
 * `flags` tag and refreshed when the admin switches one; a missing flag or a
 * database outage falls back to the defaults below.
 */

export interface Flags {
  maintenance: boolean;
  newsletter: boolean;
  /** Sign-in with an email code and email invitations (G1) — only with our own SMTP. */
  emailAuth: boolean;
  /** News in the main menu (switched on by hand, or by the first published news). */
  newsMenu: boolean;
}

const DEFAULTS: Flags = { maintenance: false, newsletter: true, emailAuth: false, newsMenu: false };

/**
 * Feature flags (feature_flags, F6) — cached with a tag; toggling them in the
 * admin refreshes it immediately. If the DB doesn't respond, defaults apply:
 * a table outage must not put the site into maintenance on its own.
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
      emailAuth: map.get("email_auth") ?? DEFAULTS.emailAuth,
      newsMenu: map.get("news_menu") ?? DEFAULTS.newsMenu,
    };
  },
  ["feature-flags"],
  { tags: [tags.flags], revalidate: PUBLIC_REVALIDATE_SECONDS },
);
