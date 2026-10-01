#!/usr/bin/env node
/**
 * Quick checks against a running app.
 *
 * Opens no browser: fetches pages and verifies they contain what the spec says
 * they should. The point is to catch regressions before someone clicks into them –
 * mainly things that break easily when a route is renamed or moved.
 *
 * Usage: npm run dev (in another window) and then `npm run test:smoke`
 *        or `BASE_URL=https://… npm run test:smoke` against a deployed version.
 */
import { htmlToText } from "./lib/html.mjs";
const BASE = process.env.BASE_URL || "http://localhost:3000";

let passed = 0;
const failures = [];

async function check(name, run) {
  try {
    await run();
    passed += 1;
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (error) {
    failures.push({ name, message: error.message });
    process.stdout.write(`  ✗ ${name}\n      ${error.message}\n`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function get(path, options = {}) {
  const response = await fetch(BASE + path, { redirect: "manual", ...options });
  const body = response.headers.get("content-type")?.includes("application/json")
    ? JSON.stringify(await response.json())
    : await response.text();
  return { status: response.status, headers: response.headers, body };
}

/**
 * Text the visitor actually sees.
 *
 * Next also ships its hydration data in the page (inside <script>), so searching
 * the whole HTML would report matches that are not on screen. React also splits
 * text with `<!-- -->` comments, so those are removed too.
 */
function visible(html) {
  return htmlToText(html)
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, " ");
}

/** Extracts all structured-data blocks from a page. */
function jsonLd(html) {
  const blocks = [
    ...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
  ];
  return blocks.flatMap((block) => {
    const parsed = JSON.parse(block[1].replace(/\\u003c/g, "<"));
    return Array.isArray(parsed) ? parsed : [parsed];
  });
}

async function main() {
  process.stdout.write(`Checks against ${BASE}\n\n`);

  process.stdout.write("Map and hub pages\n");
  for (const path of ["/", "/news", "/about", "/patrons", "/search"]) {
    await check(`${path} responds`, async () => {
      const { status } = await get(path);
      assert(status === 200, `expected 200, got ${status}`);
    });
  }

  process.stdout.write("\nRegion portrait\n");
  await check("opens the full portrait directly", async () => {
    const { status, body } = await get("/region/middle-east-north-africa");
    assert(status === 200, `status ${status}`);
    const text = visible(body);
    assert(text.includes("Key indicators"), "missing Key indicators section");
    assert(
      !text.includes("A Comprehensive Portrait"),
      "portrait label that should be gone is still there",
    );
    assert(
      !/\d+ news items? published/.test(text),
      "news counter that should be gone is still there",
    );
  });

  await check("unwritten sections have a call for support", async () => {
    const text = visible((await get("/region/east-asia")).body);
    assert(
      text.includes("Help Us Complete It By Joining Atlas Patrons"),
      "missing call to action on an empty portrait",
    );
    assert(text.includes("Not written yet"), "missing empty-section marker");
  });

  await check("indicators have data even for an empty region", async () => {
    const text = visible((await get("/region/east-asia")).body);
    assert(text.includes("Key indicators"), "missing indicators");
    assert(/\d+ of \d+ countries/.test(text), "missing country coverage on indicator");
    assert(text.includes("Human Development Index"), "missing HDI");
  });

  await check("old /full URL redirects", async () => {
    const { status, headers } = await get("/region/east-asia/full");
    assert(status === 308, `expected 308, got ${status}`);
    assert(
      headers.get("location")?.endsWith("/region/east-asia"),
      `wrong target: ${headers.get("location")}`,
    );
  });

  process.stdout.write("\nCountry panel\n");
  await check("breadcrumb to the region", async () => {
    const text = visible((await get("/country/ukraine")).body);
    assert(text.includes("Eastern Europe & Central Asia"), "missing region in breadcrumb");
    assert(text.includes("Explore the region"), "missing region card");
    assert(!/\d+ news items? published/.test(text), "news counter is still there");
  });

  await check("Kosovo has a profile and data", async () => {
    const { status, body } = await get("/country/kosovo");
    assert(status === 200, `status ${status}`);
    const text = visible(body);
    assert(text.includes("Life expectancy"), "missing indicators");
    assert(text.includes("Disputed territory"), "missing status note");
    assert(text.includes("1244"), "missing the resolution the status rests on");
  });

  await check("Western Sahara is separate", async () => {
    const { status, body } = await get("/country/western-sahara");
    assert(status === 200, `status ${status}`);
    assert(
      visible(body).includes("Non-Self-Governing"),
      "missing non-self-governing territory note",
    );
  });

  process.stdout.write("\nGlobal Issues\n");
  await check("the first global issue is the war in Ukraine", async () => {
    const { status, body } = await get("/global-issue/russia-ukraine-war");
    assert(status === 200, `status ${status}`);
    const text = visible(body);
    assert(text.includes("Russia–Ukraine War"), "missing title");
    assert(text.includes("Ukraine"), "missing issue countries");
  });

  await check("old /special URL redirects", async () => {
    const { status, headers } = await get("/special/russia-ukraine-war");
    assert(status === 308, `expected 308, got ${status}`);
    assert(
      headers.get("location")?.includes("/global-issue/russia-ukraine-war"),
      `wrong target: ${headers.get("location")}`,
    );
  });

  process.stdout.write("\nContent and relations\n");
  await check("news item links country, region and global issue", async () => {
    const text = visible((await get("/news/sahel-coup-belt")).body);
    assert(text.includes("Sub-Saharan Africa"), "missing region");
    assert(text.includes("Food Insecurity"), "missing global issue");
  });

  await check("content contains no dangerous HTML", async () => {
    const { body } = await get("/news/putins-regime");
    // Markdown goes through sanitize-html; this guards that it still holds after
    // future rendering changes.
    for (const pattern of ["onerror=", "onclick=", "javascript:", "<iframe"]) {
      assert(!body.includes(pattern), `content contains ${pattern}`);
    }
  });

  process.stdout.write("\nStructured data and SEO\n");
  await check("country has valid JSON-LD", async () => {
    const { body } = await get("/country/ukraine");
    const blocks = jsonLd(body);
    assert(blocks.length > 0, "no structured data");
    assert(
      blocks.some((block) => block["@type"] === "Country"),
      "missing type Country",
    );
  });

  await check("sitemap knows regions and global issues", async () => {
    const { body } = await get("/sitemap.xml");
    assert(body.includes("/region/middle-east-north-africa"), "missing region");
    assert(!body.includes("/full"), "sitemap still offers the removed /full");
  });

  await check("robots.txt points to the sitemap", async () => {
    const { body } = await get("/robots.txt");
    assert(body.toLowerCase().includes("sitemap"), "missing link to the sitemap");
  });

  process.stdout.write("\nSecurity\n");
  await check("responses carry security headers", async () => {
    const { headers } = await get("/");
    assert(headers.get("content-security-policy"), "missing CSP");
    assert(headers.get("x-content-type-options") === "nosniff", "missing nosniff");
    assert(headers.get("x-frame-options") === "DENY", "missing X-Frame-Options");
  });

  await check("admin without sign-in leads to /login", async () => {
    const { status, headers } = await get("/admin");
    assert(status === 307 || status === 302, `/admin returned ${status}`);
    assert(headers.get("location")?.includes("/login"), `wrong target: ${headers.get("location")}`);
  });

  await check("writing content requires sign-in", async () => {
    const { status } = await get("/api/admin/news", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    });
    assert(status === 401, `unexpected status ${status}`);
  });

  await check("login page is kept out of the index", async () => {
    const { status, body } = await get("/login");
    assert(status === 200, `/login returned ${status}`);
    assert(/noindex/.test(body), "missing noindex");
  });

  // Production build = CI or a deployed site (not a local `next dev`).
  const production = Boolean(process.env.CI) || !BASE.startsWith("http://localhost");

  await check("CSP without unsafe-eval and with HSTS (production build)", async () => {
    const { headers } = await get("/");
    const csp = headers.get("content-security-policy") ?? "";
    if (production) {
      assert(!csp.includes("unsafe-eval"), "CSP in production allows unsafe-eval");
      assert(headers.get("strict-transport-security"), "missing HSTS");
    }
    assert(csp.includes("frame-ancestors 'none'"), "CSP does not forbid framing");
  });

  await check("image optimizer is not an open proxy", async () => {
    const { status } = await get("/_next/image?url=https%3A%2F%2Fexample.org%2Fa.png&w=64&q=75");
    assert(status >= 400, `/_next/image returned ${status} for a foreign host`);
  });

  await check("demo export is not public in production", async () => {
    const { status } = await get("/api/export-demo");
    assert(status === 404 || !production, `/api/export-demo returned ${status}`);
  });

  await check("search has an upper result limit", async () => {
    const { body } = await get("/api/search?q=a&limit=100000");
    const { results } = JSON.parse(body);
    assert(Array.isArray(results) && results.length <= 40, "result limit does not work");
  });

  await check("security.txt is available", async () => {
    const { status } = await get("/.well-known/security.txt");
    assert(status === 200, `security.txt returned ${status}`);
  });

  await check("/api/health: database responds and nothing is cached", async () => {
    const { status, body, headers } = await get("/api/health");
    assert(status === 200, `/api/health returned ${status}`);
    const health = JSON.parse(body);
    assert(health.status === "ok" && health.db === "ok", `state ${body}`);
    assert(/no-store/.test(headers.get("cache-control") ?? ""), "health must not be cached");
  });

  await check("non-existent page returns 404 with a way back to the globe", async () => {
    const { status, body } = await get("/country/atlantis");
    assert(status === 404, `status ${status}`);
    assert(/Back to the globe/.test(body), "missing way back");
  });

  process.stdout.write(`\n${passed} passed, ${failures.length} failed\n`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exit(1);
});
