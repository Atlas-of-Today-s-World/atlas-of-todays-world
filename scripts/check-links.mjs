#!/usr/bin/env node
/**
 * Kontrola mrtvých odkazů (PLAN G3, ARCHITEKTURA 16.3).
 *
 * Projde všechny stránky ze sitemap.xml nasazeného webu, posbírá odkazy
 * (`<a href>`) a obrázky (`<img src>`) — interní i externí — a každý jednou
 * ověří. Nic nikam nezapisuje: výsledek je jen ve výstupu jobu (stdout a
 * souhrn GitHub Actions). Neptá se databáze, čte jen veřejný web.
 *
 * Použití: SITE_URL=https://… node scripts/check-links.mjs
 *   LINKCHECK_MAX_PAGES (výchozí 2000), LINKCHECK_CONCURRENCY (výchozí 6)
 *
 * Konec s kódem 1, když najde nefunkční odkaz (404/410, neexistující doména,
 * spojení odmítnuto…). Weby, které roboty blokují (401/403/429) nebo dočasně
 * selhaly (5xx, timeout), se vypíšou jako „nelze ověřit", job kvůli nim nepadá.
 */
import { appendFileSync } from "node:fs";

const SITE = (process.env.SITE_URL || "").replace(/\/+$/, "");
const MAX_PAGES = Number(process.env.LINKCHECK_MAX_PAGES || 2000);
const CONCURRENCY = Number(process.env.LINKCHECK_CONCURRENCY || 6);
const TIMEOUT_MS = 15_000;
const USER_AGENT = `AtlasLinkChecker/1.0 (+${SITE || "https://atlasoftodaysworld.org"})`;

if (!/^https?:\/\/[^/]+$/.test(SITE)) {
  console.error("Nastavte SITE_URL (např. https://atlasoftodaysworld.org).");
  process.exit(2);
}

/** Opakovaný běh úloh s omezenou souběžností. */
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

const decodeEntities = (value) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/g, "/")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

/** Odkazy a obrázky ze stránky jako absolutní http(s) URL bez kotvy. */
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

/** ok | broken | unknown (nelze ověřit) + popis. */
async function checkLink(url) {
  if (url.startsWith("invalid:")) return { state: "broken", detail: "neplatná adresa" };
  let response;
  try {
    response = await request(url, "HEAD");
    // Část serverů HEAD nepodporuje nebo na něj odpovídá jinak než na GET.
    if (response.status >= 400) response = await request(url, "GET");
  } catch {
    try {
      response = await request(url, "GET");
    } catch (error) {
      const code = error?.cause?.code ?? error?.name ?? "chyba";
      const definite = ["ENOTFOUND", "ECONNREFUSED", "ERR_INVALID_URL", "CERT_HAS_EXPIRED"];
      return { state: definite.includes(code) ? "broken" : "unknown", detail: String(code) };
    }
  }
  const status = response.status;
  // Tělo nepotřebujeme — uvolnit spojení.
  await response.body?.cancel().catch(() => {});
  if (status < 400) return { state: "ok", detail: String(status) };
  if ([404, 410].includes(status)) return { state: "broken", detail: String(status) };
  return { state: "unknown", detail: String(status) };
}

async function main() {
  const sitemap = await request(`${SITE}/sitemap.xml`, "GET");
  if (!sitemap.ok) throw new Error(`sitemap.xml vrátila ${sitemap.status}`);
  const pages = [...(await sitemap.text()).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)]
    .map((match) => decodeEntities(match[1]))
    // Sitemap může nést produkční doménu i při kontrole jiného nasazení.
    .map((loc) => SITE + new URL(loc).pathname)
    .slice(0, MAX_PAGES);
  console.log(`Stránek ze sitemap: ${pages.length}`);

  /** URL odkazu → stránky, na kterých je. */
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
      brokenPages.push({ url: page, detail: error?.cause?.code ?? error?.name ?? "chyba" });
    }
  });
  console.log(`Různých odkazů: ${sources.size}`);

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
        ? ` — na ${row.on.slice(0, 3).join(", ")}${row.on.length > 3 ? " …" : ""}`
        : "";
      lines.push(`- \`${row.detail}\` ${row.url}${on}`);
    }
  };
  lines.push(`## Kontrola odkazů ${SITE}`);
  lines.push(
    `\nStránek: ${pages.length} · odkazů: ${sources.size} · v pořádku: ${results.ok} · ` +
      `nefunkčních: ${results.broken.length + brokenPages.length} · nelze ověřit: ${results.unknown.length}`,
  );
  list("Stránky ze sitemap, které nejdou načíst", brokenPages);
  list("Nefunkční odkazy", results.broken);
  list("Nelze ověřit (blokují roboty, dočasná chyba)", results.unknown);

  const report = lines.join("\n");
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
  if (results.broken.length || brokenPages.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Kontrola odkazů selhala: ${error.message}`);
  process.exit(2);
});
