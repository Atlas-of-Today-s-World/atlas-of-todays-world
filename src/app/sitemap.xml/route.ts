import { getSitemaps, SITEMAPS } from "@/features/seo/queries";
import { absoluteUrl } from "@/lib/seo";
import { machineResponse } from "@/lib/seo/response";
import { latest, sitemapIndexXml } from "@/lib/seo/xml";

/** Same as PUBLIC_REVALIDATE_SECONDS (segment config must be a literal). */
export const revalidate = 3600;

/**
 * Sitemap index: one child sitemap per kind of page, each with its latest
 * change, so robots re-read only what changed. Empty ones are left out.
 */
export async function GET() {
  const sitemaps = await getSitemaps();
  const body = sitemapIndexXml(
    SITEMAPS.filter((name) => sitemaps[name].length).map((name) => ({
      loc: absoluteUrl(`/sitemaps/${name}.xml`),
      lastmod: latest(sitemaps[name].map((url) => url.lastmod)),
    })),
  );
  return machineResponse(body, "xml");
}
