import { llmsRoute, localeParams } from "@/features/seo/feeds";

/** llms.txt — Markdown map of the Atlas for language models (/llms.txt). */
export const revalidate = 3600;

export function generateStaticParams() {
  return localeParams();
}

export const GET = llmsRoute(false);
