import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Open to all robots including AI crawlers (GPTBot, ClaudeBot,
 * PerplexityBot, Google-Extended). If ATW ever doesn't want Atlas content
 * used for model training, just add a rule with `disallow: "/"`
 * for the specific user agent.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The search API has no business in the index – it generates infinite URLs.
        disallow: ["/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
