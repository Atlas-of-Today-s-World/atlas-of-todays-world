import "server-only";
import { unstable_cache } from "next/cache";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { createPublicClient } from "@/lib/supabase/public";
import { maintenanceNotice, type MaintenanceNotice } from "./maintenance";

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

/**
 * Stored maintenance title/text (site_notices, one row). Read only while the
 * switch is on, cached under its own tag. A DB error or a missing row = the
 * built-in wording (empty strings).
 */
const getStoredMaintenance = unstable_cache(
  async (): Promise<MaintenanceNotice> => {
    const { data, error } = await createPublicClient()
      .from("site_notices")
      .select("maintenance_title, maintenance_text")
      .maybeSingle();
    if (error) console.error("[site-notices]", error.message);
    return { title: data?.maintenance_title ?? "", text: data?.maintenance_text ?? "" };
  },
  ["site-notices"],
  { tags: [tags.notices], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

/**
 * The maintenance notice the public site shows instead of its pages, or null
 * while maintenance is off — the single check every public layout makes
 * (through `MaintenanceGate`).
 */
export async function getMaintenance(
  fallback: MaintenanceNotice,
): Promise<MaintenanceNotice | null> {
  const { maintenance } = await getFlags();
  return maintenanceNotice(
    maintenance,
    maintenance ? await getStoredMaintenance() : null,
    fallback,
  );
}
