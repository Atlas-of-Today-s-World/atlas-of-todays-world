import { expect, test, type APIRequestContext } from "@playwright/test";
import { jsonLdNodes, validateJsonLd } from "../src/lib/seo/jsonld-rules";

/**
 * G8 SEO & GEO: machine-readable files answer with the right type, every key
 * page carries valid structured data, canonical/robots meta are right.
 * Requests only (no browser), so it runs once, not per device project.
 */
test.describe.configure({ mode: "parallel" });
test.skip(({ isMobile }) => isMobile, "HTTP checks, independent of the device");

const html = async (request: APIRequestContext, path: string) => {
  const response = await request.get(path);
  expect(response.status(), path).toBe(200);
  return response.text();
};

const meta = (body: string, pattern: RegExp) => pattern.exec(body)?.[1];

function structuredData(body: string) {
  const blocks = [
    ...body.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
  ];
  return blocks.map((block) => JSON.parse((block[1] ?? "").replace(/\\u003c/g, "<")));
}

for (const [path, type, marker] of [
  ["/sitemap.xml", "application/xml", "<sitemapindex"],
  ["/sitemaps/countries.xml", "application/xml", "/country/czechia</loc>"],
  ["/sitemaps/news.xml", "application/xml", "<image:image>"],
  ["/feed.xml", "application/rss+xml", "<item>"],
  ["/atom.xml", "application/atom+xml", "<feed"],
  ["/llms.txt", "text/plain", "## World regions"],
  ["/llms-full.txt", "text/plain", "| [Czechia]("],
  ["/news/sahel-coup-belt.md", "text/markdown", "- Published: "],
  ["/robots.txt", "text/plain", "User-Agent: GPTBot"],
  ["/logo.png", "image/png", ""],
] as const) {
  test(`${path} answers ${type}`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain(type);
    if (marker) expect(await response.text()).toContain(marker);
  });
}

for (const path of [
  "/",
  "/region/east-asia",
  "/global-issue/russia-ukraine-war",
  "/country/czechia",
  "/view/hdi",
  "/countries",
  "/news",
  "/news/sahel-coup-belt",
  "/about",
  "/membership",
]) {
  test(`valid structured data and head on ${path}`, async ({ request }) => {
    const body = await html(request, path);
    const data = structuredData(body);
    expect(validateJsonLd(data)).toEqual([]);
    const types = data.flatMap(jsonLdNodes).map((node) => node["@type"]);
    expect(types).toEqual(expect.arrayContaining(["NGO", "WebSite"]));
    if (path !== "/") expect(types).toContain("BreadcrumbList");

    expect(meta(body, /<link rel="canonical" href="([^"]+)"/)).toBeTruthy();
    expect(meta(body, /<meta property="og:image" content="([^"]+)"/)).toBeTruthy();
    expect(meta(body, /<meta name="robots" content="([^"]+)"/)).toContain(
      "max-image-preview:large",
    );
    expect(body).toMatch(/<link rel="alternate" type="application\/rss\+xml"/);
    const title = meta(body, /<title>([^<]*)<\/title>/) ?? "";
    expect(title.replace(/&#x27;/g, "'").length).toBeLessThanOrEqual(60);
  });
}

test("a news item is a NewsArticle with dates, publisher and a Markdown alternate", async ({
  request,
}) => {
  const body = await html(request, "/news/sahel-coup-belt");
  const article = structuredData(body)
    .flatMap(jsonLdNodes)
    .find((node) => node["@type"] === "NewsArticle");
  expect(article).toMatchObject({ isAccessibleForFree: true, inLanguage: "en" });
  expect(article?.datePublished).toBeTruthy();
  expect(body).toContain('<meta property="article:published_time"');
  expect(body).toMatch(/<link rel="alternate" type="text\/markdown" href="[^"]+\.md"/);
});

test("search results stay out of the index; legal pages are canonical", async ({ request }) => {
  const search = await html(request, "/search?q=war");
  expect(meta(search, /<meta name="robots" content="([^"]+)"/)).toContain("noindex");
  const privacy = await html(request, "/privacy");
  expect(meta(privacy, /<link rel="canonical" href="([^"]+)"/)).toMatch(/\/privacy$/);
});

test("the region preview image is served without a redirect", async ({ request }) => {
  const body = await html(request, "/region/east-asia");
  const image = new URL(meta(body, /<meta property="og:image" content="([^"]+)"/) ?? "");
  const response = await request.get(image.pathname + image.search, { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
});

test("URL hygiene: /en and uppercase spellings redirect once to the canonical URL", async ({
  request,
}) => {
  for (const [from, to] of [
    ["/en/llms.txt", /\/llms\.txt$/],
    ["/News", /\/news$/],
  ] as const) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status(), from).toBe(308);
    expect(response.headers().location).toMatch(to);
  }
});
