import { describe, expect, it } from "vitest";
import { SITE_URL } from "@/lib/site";
import {
  atomXml,
  latest,
  rssXml,
  sitemapIndexXml,
  urlsetXml,
  xmlEscape,
  type FeedMeta,
} from "./xml";

const SITE = SITE_URL.replace(/\/$/, "");

/** Minimal well-formedness check: every element closes in order (CDATA and comments skipped). */
function wellFormed(xml: string) {
  const body = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "").replace(/<\?xml[^>]*\?>/, "");
  const stack: string[] = [];
  for (const match of body.matchAll(/<(\/?)([\w:.-]+)[^>]*?(\/?)>/g)) {
    const [, closing, name, selfClosing] = match;
    if (selfClosing) continue;
    if (closing) expect(stack.pop()).toBe(name);
    else stack.push(name ?? "");
  }
  expect(stack).toEqual([]);
  // No raw ampersands outside entities.
  expect(body).not.toMatch(/&(?!(amp|lt|gt|quot|apos|#\d+);)/);
}

describe("sitemaps", () => {
  it("index lists child sitemaps with lastmod", () => {
    const xml = sitemapIndexXml([
      { loc: `${SITE}/sitemaps/pages.xml`, lastmod: "2026-09-30T12:59:34.31+00:00" },
      { loc: `${SITE}/sitemaps/news.xml` },
    ]);
    wellFormed(xml);
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain("<lastmod>2026-09-30T12:59:34.310Z</lastmod>");
  });

  it("one <url> per page with images and lastmod; a single language has no hreflang", () => {
    const xml = urlsetXml([
      { path: "/region/east-asia", lastmod: "2026-09-30", images: ["https://x.org/a&b.jpg", null] },
      { path: "/privacy", languages: ["en"] },
    ]);
    wellFormed(xml);
    expect(xml.match(/<url>/g)).toHaveLength(2);
    expect(xml).toContain(`<loc>${SITE}/region/east-asia</loc>`);
    expect(xml).not.toContain("/cs/");
    expect(xml).toContain("<image:loc>https://x.org/a&amp;b.jpg</image:loc>");
    expect(xml).toContain("<lastmod>2026-09-30</lastmod>");
    // A single-language page has no alternates.
    expect(xml).toMatch(/<url><loc>[^<]+\/privacy<\/loc><\/url>/);
  });

  it("Google News entry only in the original language", () => {
    const xml = urlsetXml(
      [
        {
          path: "/news/sahel",
          languages: ["en"],
          news: { title: "Coups & soldiers", published: "2026-10-01T08:00:00Z", language: "en" },
        },
      ],
      "Atlas of Today's World",
    );
    wellFormed(xml);
    expect(xml).toContain("<news:name>Atlas of Today&apos;s World</news:name>");
    expect(xml).toContain("<news:title>Coups &amp; soldiers</news:title>");
    expect(xml).toContain(
      "<news:publication_date>2026-10-01T08:00:00.000Z</news:publication_date>",
    );
  });

  it("latest picks the newest date and ignores empty ones", () => {
    expect(latest(["2026-09-01", null, "2026-10-02T10:00:00Z", undefined, ""])).toBe(
      "2026-10-02T10:00:00Z",
    );
    expect(latest([])).toBeUndefined();
  });
});

describe("feeds", () => {
  const meta: FeedMeta = {
    title: "Atlas — news",
    description: "New articles <b>",
    home: `${SITE}/`,
    self: `${SITE}/feed.xml`,
    language: "en",
    logo: `${SITE}/logo.png`,
    email: "info@atlasoftodaysworld.org",
    publisher: "Atlas of Today's World",
  };
  const items = [
    {
      title: "Sahel & coups",
      url: `${SITE}/news/sahel`,
      summary: "Soldiers <replace> governments.",
      html: "<p>Text with ]]> inside</p>",
      published: "2026-09-02",
      updated: "2026-09-30",
      author: "Jana",
      category: "Political System",
      image: "https://x.org/a.jpg",
    },
  ];

  it("RSS 2.0 is well-formed, escaped, with self link and full text", () => {
    const xml = rssXml(meta, items);
    wellFormed(xml);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain(`<atom:link href="${SITE}/feed.xml" rel="self"`);
    expect(xml).toContain("<title>Sahel &amp; coups</title>");
    expect(xml).toContain("<pubDate>Wed, 02 Sep 2026 00:00:00 GMT</pubDate>");
    expect(xml).toContain("<![CDATA[<p>Text with ]]]]><![CDATA[> inside</p>]]>");
    expect(xml).toContain("<lastBuildDate>Wed, 30 Sep 2026 00:00:00 GMT</lastBuildDate>");
  });

  it("Atom is well-formed with ids, dates and escaped HTML content", () => {
    const xml = atomXml(meta, items);
    wellFormed(xml);
    expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">');
    expect(xml).toContain(`<id>${SITE}/news/sahel</id>`);
    expect(xml).toContain("<updated>2026-09-30T00:00:00.000Z</updated>");
    expect(xml).toContain('<content type="html">&lt;p&gt;Text');
  });

  it("an empty feed is still valid", () => {
    wellFormed(rssXml(meta, []));
    wellFormed(atomXml(meta, []));
  });

  it("escapes markup and drops control characters", () => {
    expect(xmlEscape(`<a href="x">'&'</a>\u0001`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;",
    );
  });
});
