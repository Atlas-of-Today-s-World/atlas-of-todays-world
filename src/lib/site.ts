/** Canonical site URL – used by the sitemap, robots and og:url. */
import { publicEnv } from "./env";

export const SITE_URL = publicEnv.NEXT_PUBLIC_SITE_URL;

/**
 * Every address this site has been served from. The database keeps photo URLs
 * written under an earlier one (the Vercel address before the own domain); they
 * are still our photos, served from the canonical domain and resized (lib/images).
 */
export const SITE_ORIGINS: ReadonlySet<string> = new Set([
  new URL(SITE_URL).origin,
  "https://atlas-of-todays-world.vercel.app",
  "https://atlasoftodaysworld.org",
  "https://www.atlasoftodaysworld.org",
]);
