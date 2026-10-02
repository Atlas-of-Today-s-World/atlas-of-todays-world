import { describe, expect, it } from "vitest";
import { SITE_URL } from "@/lib/site";
import { llmsFullTxt, llmsTxt } from "./llms";
import { ALLOWED_BOTS, robotsRules } from "./robots";

describe("llms.txt", () => {
  const head = llmsTxt({
    title: "Atlas of Today's World",
    summary: "A non-profit\nencyclopedia of the present.",
    paragraphs: ["Published by a non-profit."],
    sections: [
      {
        title: "World regions",
        links: [
          {
            name: "East [Asia]",
            url: "https://x.org/region/east-asia",
            note: "Workshop\n of the world",
          },
        ],
      },
      { title: "Empty", links: [] },
    ],
    optional: [{ name: "Chad", url: "https://x.org/country/chad" }],
  });

  it("follows the spec: H1, blockquote, paragraphs, H2 link lists, Optional", () => {
    expect(head).toBe(
      [
        "# Atlas of Today's World",
        "> A non-profit encyclopedia of the present.",
        "Published by a non-profit.",
        "## World regions\n\n- [East Asia](https://x.org/region/east-asia): Workshop of the world",
        "## Optional\n\n- [Chad](https://x.org/country/chad)",
      ].join("\n\n") + "\n",
    );
  });

  it("llms-full.txt appends full documents with URL and facts", () => {
    const full = llmsFullTxt(head, [
      {
        title: "Sahel",
        url: "https://x.org/news/sahel",
        facts: ["Published: 2026-09-02"],
        markdown: "Text.",
      },
    ]);
    expect(full.startsWith(head.trimEnd())).toBe(true);
    expect(full).toContain(
      "---\n\n# Sahel\n\nURL: https://x.org/news/sahel  \nPublished: 2026-09-02\n\nText.\n",
    );
  });
});

describe("robots.txt", () => {
  const robots = robotsRules();
  const rules = Array.isArray(robots.rules) ? robots.rules : [robots.rules];

  it("explicitly allows search engines and AI crawlers, and everyone else", () => {
    for (const bot of [
      "Googlebot",
      "Bingbot",
      "Google-Extended",
      "GPTBot",
      "OAI-SearchBot",
      "ChatGPT-User",
      "PerplexityBot",
      "ClaudeBot",
      "Claude-SearchBot",
      "CCBot",
      "Applebot-Extended",
      "SeznamBot",
    ]) {
      expect(ALLOWED_BOTS).toContain(bot);
    }
    expect(rules[0]?.userAgent).toEqual([...ALLOWED_BOTS]);
    expect(rules[1]?.userAgent).toBe("*");
    for (const rule of rules) expect(rule.allow).toBe("/");
  });

  it("keeps private and transactional paths closed in every language", () => {
    for (const rule of rules) {
      expect(rule.disallow).toEqual(
        expect.arrayContaining([
          "/api/",
          "/admin",
          "/auth/",
          "/membership/checkout",
          "/cs/membership/checkout",
          "/membership/thank-you",
          "/membership/manage",
          "/preview/",
          "/cs/preview/",
        ]),
      );
      // Public content is never blocked.
      expect(rule.disallow).not.toContain("/");
      expect(rule.disallow).not.toContain("/news");
    }
  });

  it("points to the sitemap index and has no non-standard Host", () => {
    expect(robots.sitemap).toBe(new URL("/sitemap.xml", SITE_URL).toString());
    expect(robots.host).toBeUndefined();
  });
});
