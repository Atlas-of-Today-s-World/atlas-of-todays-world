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
 * The region's preview in the wide side panel; "Full page view" at its top
 * leads to the whole article (2026-10-16). The old short/long split is gone —
 * `/region/[slug]/full` still redirects here (src/config/redirects.ts).
 */
export default groupPortraitPage("region", "rail");
