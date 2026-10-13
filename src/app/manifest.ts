import type { MetadataRoute } from "next";
import { THEME_COLORS } from "@/config/palette";
import { getSiteSettings } from "@/features/site/queries";

/** Web manifest – makes Atlas an installable app and complements SEO (name and description from the site settings). */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const site = await getSiteSettings();
  return {
    name: site.name,
    short_name: "Atlas",
    description: site.seoDescription,
    start_url: "/",
    display: "standalone",
    background_color: THEME_COLORS.spaceDeep,
    theme_color: THEME_COLORS.space,
    categories: ["education", "news", "reference"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/logo.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
