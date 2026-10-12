import {
  groupMetadata,
  groupPortraitPage,
  groupStaticParams,
} from "@/features/portraits/group-page";

// Global Issues are created in the admin, so the route must also handle a slug
// that didn't exist at build time.
export const dynamicParams = true;

export const generateStaticParams = groupStaticParams("issue");

export const generateMetadata = groupMetadata("issue");

/** Portrait of a global issue or a custom region (the same `Portrait` as a region's). */
export default groupPortraitPage("issue");
