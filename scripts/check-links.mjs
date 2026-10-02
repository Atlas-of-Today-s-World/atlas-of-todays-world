#!/usr/bin/env node
/**
 * Dead link check (PLAN G3, ARCHITEKTURA 16.3).
 *
 * Walks every page from the deployed site's sitemap.xml, collects links
 * (`<a href>`) and images (`<img src>`) — internal and external — and checks
 * each one once. Writes nothing anywhere: the result is only in the job output
 * (stdout and the GitHub Actions summary). No database access, public site only.
 *
 * Usage: SITE_URL=https://… node scripts/check-links.mjs
 *   LINKCHECK_MAX_PAGES (default 2000), LINKCHECK_CONCURRENCY (default 6)
 *
 * Exits with code 1 when it finds a broken link (404/410, non-existent domain,
 * connection refused…). Sites that block bots (401/403/429) or failed
 * temporarily (5xx, timeout) are listed as "cannot verify"; the job does not fail on them.
 */
import { appendFileSync } from "node:fs";
import { decodeEntities } from "./lib/html.mjs";

const SITE = (process.env.SITE_URL || "").replace(/\/+$/, "");
const MAX_PAGES = Number(process.env.LINKCHECK_MAX_PAGES || 2000);
const CONCURRENCY = Number(process.env.LINKCHECK_CONCURRENCY || 6);
const TIMEOUT_MS = 15_000;
const USER_AGENT = `AtlasLinkChecker/1.0 (+${SITE || "https://atlasoftodaysworld.org"})`;

if (!/^https?:\/\/[^/]+$/.test(SITE)) {
  console.error("Set SITE_URL (e.g. https://atlasoftodaysworld.org).");
  process.exit(2);
}

/** Runs tasks with limited concurrency. */
async function pool(items, limit, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await worker(queue.shift());
  });
  await Promise.all(runners);
}

async function request(url, method) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html,*/*;q=0.8" },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Links and images from a page as absolute http(s) URLs without a fragment. */
function extractLinks(html, pageUrl) {
  const found = new Set();
  const pattern = /<(a|img)\b[^>]*?\s(href|src)\s*=\s*("([^"]*)"|'([^']*)')/gi;
  for (const match of html.matchAll(pattern)) {
    const raw = decodeEntities((match[4] ?? match[5] ?? "").trim());
    if (!raw || raw.startsWith("#") || /^(mailto|tel|javascript|data|blob):/i.test(raw)) continue;
    let url;
    try {
      url = new URL(raw, pageUrl);
    } catch {
      found.add(`invalid:${raw}`);
      continue;
    }
    if (!/^https?:$/.test(url.protocol)) continue;
    if (url.origin === SITE && url.pathname.startsWith("/_next/")) continue;
    url.hash = "";
    found.add(url.href);
  }
  return found;
}

/** ok | broken | unknown (cannot verify) + detail. */
async function checkLink(url) {
  if (url.startsWith("invalid:")) return { state: "broken", detail: "invalid address" };
  let response;
  try {
    response = await request(url, "HEAD");
    // Some servers do not support HEAD or answer it differently than GET.
    if (response.status >= 400) response = await request(url, "GET");
  } catch {
    try {
      response = await request(url, "GET");
    } catch (error) {
      const code = error?.cause?.code ?? error?.name ?? "error";
      const definite = ["ENOTFOUND", "ECONNREFUSED", "ERR_INVALID_URL", "CERT_HAS_EXPIRED"];
      return { state: definite.includes(code) ? "broken" : "unknown", detail: String(code) };
    }
  }
  const status = response.status;
  // We do not need the body — release the connection.
  await response.body?.cancel().catch(() => {});
  if (status < 400) return { state: "ok", detail: String(status) };
  if ([404, 410].includes(status)) return { state: "broken", detail: String(status) };
  return { state: "unknown", detail: String(status) };
}

/** <loc> URLs of a sitemap, on the checked deployment (the sitemap carries the production domain). */
async function sitemapLocs(path) {
  const response = await request(`${SITE}${path}`, "GET");
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  const xml = await response.text();
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(
    (match) => SITE + new URL(decodeEntities(match[1])).pathname,
  );
  return { index: xml.includes("<sitemapindex"), locs };
}

async function main() {
  // /sitemap.xml is an index of child sitemaps (pages, regions, countries, news…).
  const root = await sitemapLocs("/sitemap.xml");
  const children = root.index
    ? await Promise.all(root.locs.map((loc) => sitemapLocs(new URL(loc).pathname)))
    : [root];
  const pages = [...new Set(children.flatMap((child) => child.locs))].slice(0, MAX_PAGES);
  console.log(`Pages from sitemap: ${pages.length}`);

  /** Link URL → pages it appears on. */
  const sources = new Map();
  const brokenPages = [];
  await pool(pages, CONCURRENCY, async (page) => {
    try {
      const response = await request(page, "GET");
      if (!response.ok) {
        brokenPages.push({ url: page, detail: String(response.status) });
        return;
      }
      for (const link of extractLinks(await response.text(), page)) {
        if (!sources.has(link)) sources.set(link, new Set());
        sources.get(link).add(new URL(page).pathname);
      }
    } catch (error) {
      brokenPages.push({ url: page, detail: error?.cause?.code ?? error?.name ?? "error" });
    }
  });
  console.log(`Distinct links: ${sources.size}`);

  const results = { ok: 0, broken: [], unknown: [] };
  await pool([...sources.keys()], CONCURRENCY, async (link) => {
    const result = await checkLink(link);
    if (result.state === "ok") results.ok += 1;
    else
      results[result.state].push({ url: link, detail: result.detail, on: [...sources.get(link)] });
  });

  const lines = [];
  const list = (title, rows) => {
    if (!rows.length) return;
    lines.push(`\n### ${title} (${rows.length})\n`);
    for (const row of rows.sort((a, b) => a.url.localeCompare(b.url))) {
      const on = row.on
        ? ` — on ${row.on.slice(0, 3).join(", ")}${row.on.length > 3 ? " …" : ""}`
        : "";
      lines.push(`- \`${row.detail}\` ${row.url}${on}`);
    }
  };
  lines.push(`## Link check ${SITE}`);
  lines.push(
    `\nPages: ${pages.length} · links: ${sources.size} · ok: ${results.ok} · ` +
      `broken: ${results.broken.length + brokenPages.length} · cannot verify: ${results.unknown.length}`,
  );
  list("Sitemap pages that fail to load", brokenPages);
  list("Broken links", results.broken);
  list("Cannot verify (bots blocked, temporary error)", results.unknown);

  const report = lines.join("\n");
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
  if (results.broken.length || brokenPages.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Link check failed: ${error.message}`);
  process.exit(2);
});
