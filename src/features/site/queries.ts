import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { createPublicClient } from "@/lib/supabase/public";
import {
  SETTINGS_COLUMNS,
  SITE_DEFAULTS,
  SOCIAL_DEFAULTS,
  settingsFromRow,
  socialsFromRows,
  withSettingsDefaults,
  type SettingsRow,
  type SiteSettings,
  type SocialLink,
} from "./model";

/**
 * Site settings and social links — public reads (layer: features/<domain>/queries.ts).
 * Cached under the `site` tag, refreshed when the admin saves. The cached part
 * throws on a database error, so a failure is never cached; the wrappers then
 * fall back to the values the code had before the admin (model.ts), so the
 * site never breaks on this table.
 */

const readSettings = unstable_cache(
  async (): Promise<SiteSettings | null> => {
    const { data, error } = await createPublicClient()
      .from("site_settings")
      .select(SETTINGS_COLUMNS)
      .eq("id", 1)
      .maybeSingle<SettingsRow>();
    if (error) throw new Error(error.message);
    return data ? settingsFromRow(data) : null;
  },
  // "v2": the entry gained `sectionOrder` (2026-10-16). A new key keeps the
  // old-shaped entry from being served after the deploy; withSettingsDefaults
  // below is the safety net for any shape the cache still hands back.
  ["site-settings", "v2"],
  { tags: [tags.site], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

const readSocialLinks = unstable_cache(
  async (): Promise<SocialLink[]> => {
    const { data, error } = await createPublicClient()
      .from("site_social_links")
      .select("label, url, icon")
      .eq("visible", true)
      .order("position")
      .order("created_at")
      .order("id");
    if (error) throw new Error(error.message);
    return socialsFromRows(data);
  },
  ["site-social-links"],
  { tags: [tags.site], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

/** The publisher's facts, contact and SEO defaults; the defaults when the row is missing or unreadable. */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const settings = await readSettings();
    return settings ? withSettingsDefaults(settings) : SITE_DEFAULTS;
  } catch (error) {
    console.error("[site] settings:", error instanceof Error ? error.message : error);
    return SITE_DEFAULTS;
  }
});

/**
 * Visible social links in their order. An empty table is the team's choice
 * (no badges); only a failed read falls back to the links the code had.
 */
export const getSocialLinks = cache(async (): Promise<readonly SocialLink[]> => {
  try {
    return await readSocialLinks();
  } catch (error) {
    console.error("[site] social links:", error instanceof Error ? error.message : error);
    return SOCIAL_DEFAULTS;
  }
});
