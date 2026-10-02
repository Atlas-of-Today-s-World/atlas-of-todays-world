import { llmsRoute, localeParams } from "@/features/seo/feeds";

/** llms-full.txt — llms.txt plus the full text of all articles and the country data. */
export const revalidate = 3600;

export function generateStaticParams() {
  return localeParams();
}

export const GET = llmsRoute(true);
