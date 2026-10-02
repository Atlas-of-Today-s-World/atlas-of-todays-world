import { feedRoute, localeParams } from "@/features/seo/feeds";

/** Atom feed of the latest news and entries (/atom.xml, /cs/atom.xml). */
export const revalidate = 3600;

export function generateStaticParams() {
  return localeParams();
}

export const GET = feedRoute("atom");
