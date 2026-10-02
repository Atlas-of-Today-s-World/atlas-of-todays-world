import type { MetadataRoute } from "next";

/** Web manifest – makes Atlas an installable app and complements SEO. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atlas of Today's World",
    short_name: "Atlas",
    description:
      "An interactive encyclopedia of the present on a 3D satellite globe: every country, every world region, and the data behind them.",
    start_url: "/",
    display: "standalone",
    background_color: "#070b16",
    theme_color: "#0a1020",
    categories: ["education", "news", "reference"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/logo.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
