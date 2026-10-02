import { feedRoute, localeParams } from "@/features/seo/feeds";

/** RSS 2.0 feed of the latest news and entries (/feed.xml, /cs/feed.xml). */
export const revalidate = 3600;

export function generateStaticParams() {
  return localeParams();
}

export const GET = feedRoute("rss");
