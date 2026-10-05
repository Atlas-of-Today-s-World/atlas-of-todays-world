#!/usr/bin/env node
/**
 * Scrapes the published Global Issues topics from the old Webflow site into one
 * JSON file that `import-topics.mjs` loads into the database.
 *
 *   node scripts/webflow/scrape-global-issues.mjs [--out scripts/webflow/data/global-issues.json]
 *
 * The CMS export does not contain the rendered chapter tabs and the "Learn more"
 * panes, so the public pages are the most complete source. Only topics with
 * real text are kept ("We are looking for authors" placeholders are skipped).
 * Runs headless Chromium from the dev dependency Playwright.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";

const ORIGIN = "https://www.atlasoftodaysworld.org";
const { values: args } = parseArgs({
  options: { out: { type: "string", default: "scripts/webflow/data/global-issues.json" } },
});

/** Runs in the page: the lens list (category → topic paths) of /global-issues. */
function readLenses() {
  const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const lenses = [];
  for (const link of document.querySelectorAll('a[href*="/articles-global-issues/"]')) {
    const href = new URL(link.getAttribute("href"), location.href);
    if (!/atlasoftodaysworld\.org$/.test(href.hostname)) continue;
    // The lens is the nearest preceding block heading ("Migration", "Human Rights", …).
    let block = link.parentElement;
    let lens = "";
    while (block && !lens) {
      const heading = block.querySelector?.("h2, h3");
      if (heading && !link.contains(heading)) lens = text(heading);
      block = block.parentElement;
    }
    lenses.push({ path: href.pathname, lens, label: text(link) });
  }
  return lenses;
}

/** Runs in the page: one topic page → plain data. */
function readTopic() {
  const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const bgUrl = (el) => {
    const match = (el?.getAttribute("style") ?? "").match(/url\(["']?([^"')]+)["']?\)/);
    return match ? match[1] : null;
  };
  let citation = 0;

  /** Chapter body: Webflow keeps source popovers as escaped markup inside the rich text. */
  const POPOVER =
    /&lt;span class="span"&gt;\s*&lt;span[^&]*?class="box-source"&gt;([\s\S]*?)&lt;\/span&gt;\s*&lt;div class="popover"&gt;([\s\S]*?)&lt;\/div&gt;\s*&lt;\/div&gt;\s*&lt;\/span&gt;/g;
  const escapeAttr = (value) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const cleanBody = (source) => {
    const html = source.innerHTML
      // Highlight boxes were written as escaped <h6 class="textbox"> — keep them as quotes.
      .replace(/&lt;h6[^&]*?&gt;/g, "<blockquote>")
      .replace(/&lt;\/h6&gt;/g, "</blockquote>")
      .replace(POPOVER, (match, word, popover, offset, whole) => {
        const lead = /\s$/.test(whole.slice(0, offset)) ? "" : " ";
        const holder = document.createElement("div");
        holder.innerHTML = popover.replace(/&lt;\/?(div|br)[^&]*?&gt;/g, " ");
        const href = holder.querySelector("a[href]")?.getAttribute("href");
        if (!href) return `${lead}${word} `;
        citation += 1;
        const title = text(holder)
          .replace(/^Source:\s*/, "")
          .slice(0, 300);
        return `${lead}${word}<sup><a href="${escapeAttr(href)}" title="${escapeAttr(title)}">[${citation}]</a></sup> `;
      });
    const root = document.createElement("div");
    // Any other escaped helper markup is dropped as text.
    root.innerHTML = html.replace(/&lt;\/?(span|div|br)[^&]*?&gt;/g, "");
    for (const junk of root.querySelectorAll("script, style, .w-embed")) junk.remove();
    return root.innerHTML
      .replace(/\s+/g, " ")
      .replace(/<p>[\s‍]*<\/p>/g, "")
      .trim();
  };

  const head = document.querySelector(".head-of-article");
  const tabs = [...document.querySelectorAll("a.chapter-tab")];
  const chapters = [...document.querySelectorAll(".full-chapter-section")]
    .map((section, index) => {
      const image = section.querySelector(".div-block-91 img, img.first-image-core-reading");
      const teaser = section
        .closest(".w-tab-pane")
        ?.querySelector(".complete-picture-body .rich-text-big-picture");
      const body = section.querySelector(".rich-text-core-entry");
      return {
        title: text(section.querySelector("h2")) || text(tabs[index]),
        tileImage: bgUrl(tabs[index]) ?? image?.getAttribute("src") ?? null,
        image: image?.getAttribute("src") ?? null,
        imageCredit: text(section.querySelector(".source-of-photo")).replace(/^Photo:\s*/, ""),
        teaser: text(teaser),
        bodyHtml: body ? cleanBody(body) : "",
      };
    })
    .filter((chapter) => chapter.title && chapter.bodyHtml.length > 50);

  const learnMore = [...document.querySelectorAll(".learn-more-section .w-tab-pane")].map(
    (pane) => {
      const label = text(pane.querySelector(".heading-resource-tabs")).replace(
        "Eductional",
        "Educational",
      );
      const links = [];
      let group = "";
      for (const el of pane.querySelectorAll(
        "h4:not(.heading-resource-tabs), p, a.w-inline-block",
      )) {
        if (el.tagName === "H4") {
          group = text(el);
          continue;
        }
        if (el.tagName === "A") {
          links.push({
            title: text(el) || "Download",
            url: el.getAttribute("href"),
            source: "",
            description: "PDF",
          });
          continue;
        }
        const a = el.querySelector("a[href]");
        if (!a) continue;
        const full = text(el).replace(/^\d+\.\s*/, "");
        const title = text(a);
        const at = full.indexOf(title);
        const before = at > 0 ? full.slice(0, at).trim() : "";
        const after =
          at >= 0
            ? full
                .slice(at + title.length)
                .replace(/^[.\s]+/, "")
                .trim()
            : "";
        links.push({
          title: title.slice(0, 200),
          url: a.getAttribute("href"),
          source: [before, after].filter(Boolean).join(" ").replace(/\.$/, "").slice(0, 120),
          description: group.slice(0, 600),
        });
      }
      return { label, links };
    },
  );

  const card = document.querySelector(".hidden-part-accordion-authors");
  const works = card?.querySelector(".rich-text-block-2");
  return {
    title: text(head?.querySelector("h1")),
    summaryPoints: [...(head?.querySelectorAll(".super-summary p") ?? [])]
      .map((p) => text(p).replace(/^•\s*/, ""))
      .filter(Boolean),
    author: text(head?.querySelector(".page-info-white")),
    authorPhoto: head?.querySelector(".author-s-photo-in-header")?.getAttribute("src") ?? null,
    authorBio: text(card?.querySelector(".author-s-bio")),
    positionality: text(card?.querySelector(".positionality-text")),
    worksHtml: works ? works.innerHTML.replace(/\s+/g, " ").trim() : "",
    updated: text(head?.querySelector(".update .page-info-white")),
    hero:
      document.querySelector("img.article-picture[src]")?.getAttribute("src") ??
      bgUrl(document.querySelector(".main-screen-article-section")) ??
      null,
    heroCredit: text(head?.querySelector(".picture-caprtion-text-head")).replace(/^Photo:\s*/, ""),
    chapters,
    learnMore,
  };
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${ORIGIN}/global-issues`, { waitUntil: "domcontentloaded" });
const seen = new Set();
const lenses = (await page.evaluate(readLenses)).filter(
  (item) => !seen.has(item.path) && seen.add(item.path),
);

const topics = [];
for (const item of lenses) {
  await page.goto(`${ORIGIN}${item.path}`, { waitUntil: "domcontentloaded" });
  const topic = await page.evaluate(readTopic);
  const slug = item.path.split("/").pop();
  if (!topic.title || topic.chapters.length === 0) {
    console.log(`skip  ${slug} (no chapters)`);
    continue;
  }
  const links = topic.learnMore.reduce((sum, section) => sum + section.links.length, 0);
  console.log(`ok    ${slug}: ${topic.chapters.length} chapters, ${links} links`);
  topics.push({ slug, oldPath: item.path, lens: item.lens, ...topic });
}
await browser.close();

const out = resolve(args.out);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify({ scrapedAt: new Date().toISOString(), topics }, null, 2)}\n`);
console.log(`\n${topics.length} topics → ${args.out}`);
