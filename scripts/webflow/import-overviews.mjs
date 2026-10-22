#!/usr/bin/env node
/**
 * Fills the subtopics' Overview (entry_chapters.overview) of the topics
 * imported from the old site. The first import (import-topics.mjs) put each
 * overview, cut to 300 characters, in the subtopic's key points; this reads
 * the whole overview, paragraph by paragraph, from the old pages.
 *
 *   node scripts/webflow/import-overviews.mjs --sql <file>
 *        [--data scripts/webflow/data/global-issues.json] [--origin https://atlasoftodaysworld.webflow.io]
 *
 * Writes one SQL transaction (for psql or the Supabase SQL editor). It only
 * fills an empty overview of the subtopic at the same position with the same
 * title, and drops the key point only while it is still the cut copy of the
 * overview — what editors wrote or changed stays. Repeatable.
 * Runs headless Chromium from the dev dependency Playwright.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";

const { values: args } = parseArgs({
  options: {
    data: { type: "string", default: "scripts/webflow/data/global-issues.json" },
    // www.atlasoftodaysworld.org serves the new site now.
    origin: { type: "string", default: "https://atlasoftodaysworld.webflow.io" },
    sql: { type: "string" },
  },
});
if (!args.sql) throw new Error("Usage: --sql <file>");

const { topics } = JSON.parse(readFileSync(args.data, "utf8"));

/** Runs in the page: each chapter tab's Overview box — its title and paragraphs. */
function readOverviews() {
  const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  return [...document.querySelectorAll(".complete-picture-body")].map((box) => {
    const body = box.querySelector(".rich-text-big-picture");
    const paragraphs = body ? [...body.querySelectorAll("p")].map(text).filter(Boolean) : [];
    return {
      title: text(box.querySelector(".complete-picture-title")),
      overview: paragraphs.length ? paragraphs.join("\n\n") : text(body),
    };
  });
}

/** A dollar-quoted SQL literal. */
const literal = (value) => {
  if (value.includes("$ov$")) throw new Error(`Text contains the quote tag: ${value.slice(0, 60)}`);
  return `$ov$${value}$ov$`;
};

const browser = await chromium.launch();
const page = await browser.newPage();
const statements = [];
let found = 0;
for (const topic of topics) {
  await page.goto(`${args.origin}${topic.oldPath}`, { waitUntil: "domcontentloaded" });
  const boxes = await page.evaluate(readOverviews);
  topic.chapters.slice(0, 12).forEach((chapter, position) => {
    const title = (chapter.title ?? "").trim().slice(0, 200);
    const box = boxes.find((item) => item.title === chapter.title) ?? boxes[position];
    const overview = (box?.overview ?? "").slice(0, 3000);
    if (!overview) {
      console.warn(`${topic.slug} #${position + 1}: no overview on the old page`);
      return;
    }
    found += 1;
    // What import-topics.mjs stored as the subtopic's only key point.
    const cut = (chapter.teaser ?? "").trim().slice(0, 300);
    statements.push(`update entry_chapters c
   set overview = ${literal(overview)},
       summary_points = case when c.summary_points = array[${literal(cut)}]::text[]
                             then '{}'::text[] else c.summary_points end
  from entries e
 where e.id = c.entry_id and e.slug = ${literal(topic.slug)} and e.locale = 'en'
   and c.position = ${position} and c.title = ${literal(title)} and c.overview = '';`);
  });
  console.log(`${topic.slug}: ${boxes.length} overview boxes`);
}
await browser.close();

writeFileSync(args.sql, `begin;\n\n${statements.join("\n\n")}\n\ncommit;\n`);
console.log(`\n${found} overviews in ${topics.length} topics → ${args.sql}`);
