import {
  groupMetadata,
  groupPortraitPage,
  groupStaticParams,
} from "@/features/portraits/group-page";

// true: with false, Next returns 404 after revalidateTag (an admin write) even for
// existing pages (NoFallbackError). An unknown slug ends up in notFound().
export const dynamicParams = true;

export const generateStaticParams = groupStaticParams("region");

export const generateMetadata = groupMetadata("region");

/**
 * Region portrait. The short version is gone – the brief wants one full portrait
 * with no intermediate step, so `/region/[slug]/full` just redirects (see next.config.ts).
 */
export default groupPortraitPage("region");
