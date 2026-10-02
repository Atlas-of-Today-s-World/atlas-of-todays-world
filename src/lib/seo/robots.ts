import type { MetadataRoute } from "next";
import { LOCALES, localePath } from "@/features/i18n/config";
import { absoluteUrl } from "./index";

/**
 * Search engines and AI crawlers named on purpose (ADR-021). A crawler with
 * its own group ignores the `*` group, so the named group repeats the same
 * rules — listing them documents that the Atlas *wants* to be read and cited
 * by answer engines (and lets one be closed later by moving it out).
 * Google-Extended and Applebot-Extended are control tokens (AI use of
 * content already crawled by Googlebot/Applebot), not crawlers.
 */
export const ALLOWED_BOTS = [
  // Search engines
  "Googlebot",
  "Bingbot",
  "Applebot",
  "DuckDuckBot",
  "SeznamBot",
  "YandexBot",
  // AI search and assistants (answers with links back to the source)
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "DuckAssistBot",
  "MistralAI-User",
  "Amzn-SearchBot",
  // AI models (training and grounding)
  "Google-Extended",
  "Applebot-Extended",
  "GPTBot",
  "ClaudeBot",
  "CCBot",
  "Amazonbot",
  "Meta-ExternalAgent",
] as const;

/** Private, transactional or per-user paths (no content for the index). */
const PRIVATE_PATHS = [
  "/membership/checkout",
  "/membership/thank-you",
  "/membership/manage",
  "/preview/",
  "/ucet",
  "/pozvanka",
];
const UNLOCALIZED_PRIVATE = ["/api/", "/admin", "/auth/"];

export function robotsRules(): MetadataRoute.Robots {
  const disallow = [
    ...UNLOCALIZED_PRIVATE,
    ...LOCALES.flatMap((locale) => PRIVATE_PATHS.map((path) => localePath(locale, path))),
  ];
  const rules = { allow: "/", disallow: [...new Set(disallow)] };
  return {
    rules: [
      { userAgent: [...ALLOWED_BOTS], ...rules },
      { userAgent: "*", ...rules },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
