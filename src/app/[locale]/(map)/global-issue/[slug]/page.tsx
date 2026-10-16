import {
  groupMetadata,
  groupPortraitPage,
  groupStaticParams,
} from "@/features/portraits/group-page";

// true: with false, Next returns 404 after revalidateTag (an admin write) even for
// existing pages (NoFallbackError). An unknown slug ends up in notFound().
export const dynamicParams = true;

export const generateStaticParams = groupStaticParams("issue");

export const generateMetadata = groupMetadata("issue");

/**
 * A global issue's preview in the wide side panel; "Full page view" at its top
 * leads to the whole article (2026-10-16).
 */
export default groupPortraitPage("issue", "rail");
