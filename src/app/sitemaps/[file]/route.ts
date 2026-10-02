import { getSitemaps, SITEMAPS, type SitemapName } from "@/features/seo/queries";
import { ORGANIZATION } from "@/config/organization";
import { machineResponse } from "@/lib/seo/response";
import { urlsetXml } from "@/lib/seo/xml";

/** Same as PUBLIC_REVALIDATE_SECONDS (segment config must be a literal). */
export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return SITEMAPS.map((name) => ({ file: `${name}.xml` }));
}

/** One child sitemap of /sitemap.xml (pages, regions, countries, data, news, entries…). */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const name = file.replace(/\.xml$/, "") as SitemapName;
  if (!SITEMAPS.includes(name)) return new Response("Not found", { status: 404 });
  const sitemaps = await getSitemaps();
  return machineResponse(urlsetXml(sitemaps[name], ORGANIZATION.name), "xml");
}
