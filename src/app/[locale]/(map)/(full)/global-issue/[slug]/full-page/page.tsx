import { groupMetadata, groupPortraitPage } from "@/features/portraits/group-page";

export const dynamicParams = true;

/**
 * Nothing is prebuilt here: generating both views of every issue ran the
 * database into its statement timeout during the build. The preview carries
 * the static params; this page renders on first request and is then cached.
 */
export const generateStaticParams = () => [];

export const generateMetadata = groupMetadata("issue");

/** A global issue's whole portrait as a full-width article (IssueArticle). */
export default groupPortraitPage("issue", "full");
