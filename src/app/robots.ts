import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Otevřeno pro všechny roboty včetně AI crawlerů (GPTBot, ClaudeBot,
 * PerplexityBot, Google-Extended). Kdyby ATW nechtělo, aby se obsah Atlasu
 * používal pro trénink modelů, stačí sem přidat pravidlo s `disallow: "/"`
 * pro konkrétního user-agenta.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Vyhledávací API nemá co dělat v indexu – generuje nekonečno URL.
        disallow: ["/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
