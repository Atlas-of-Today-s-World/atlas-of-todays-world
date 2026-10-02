import { describe, expect, it } from "vitest";
import type { Encyclopedia, Entry } from "@/features/entries/queries";
import type { Atlas } from "@/features/geography/types";
import { SITE_URL } from "@/lib/site";
import { articleMarkdown } from "./documents";

const SITE = SITE_URL.replace(/\/$/, "");

const atlas = {
  regionBySlug: new Map([["sub-saharan-africa", { name: "Sub-Saharan Africa" }]]),
  countryByIso3: new Map([["TCD", { name: "Chad" }]]),
} as unknown as Atlas;

const news: Entry = {
  slug: "sahel-coup-belt",
  title: "The Sahel's Coup Belt",
  summary: "Soldiers replace elected governments.",
  category: "Political System",
  region: "sub-saharan-africa",
  issue: null,
  countries: ["TCD"],
  author: "Jana Dvořáková",
  authorSlug: "jana-dvorakova",
  published: "2026-09-02",
  updated: "2026-09-30",
  languages: ["en"],
  html: '<h2>Why</h2><p>Because <a href="https://acleddata.com">ACLED</a> says so.</p>',
  locale: "en",
};

describe("article Markdown", () => {
  it("news: title, citable facts first, then the text", () => {
    expect(articleMarkdown("news", news, atlas)).toBe(
      [
        "# The Sahel's Coup Belt",
        [
          `- URL: ${SITE}/news/sahel-coup-belt`,
          "- Published: 2026-09-02",
          "- Last updated: 2026-09-30",
          `- Author: Jana Dvořáková (${SITE}/authors/jana-dvorakova)`,
          "- Category: Political System",
          "- Region: Sub-Saharan Africa",
          "- Countries: Chad",
          `- Publisher: Atlas of Today's World (${SITE}/)`,
        ].join("\n"),
        "Soldiers replace elected governments.",
        "## Why",
        "Because [ACLED](https://acleddata.com) says so.",
      ].join("\n\n") + "\n",
    );
  });

  it("entry: answer-first summary, key points, topics, FAQ and sources; Czech labels for Czech text", () => {
    const entry = {
      ...news,
      slug: "smuggling",
      locale: "cs",
      author: undefined,
      authorSlug: undefined,
      html: "",
      summaryPoints: ["Bod jedna"],
      chapters: [{ title: "Trasy", summaryPoints: ["Moře"], html: "<p>Text.</p>" }],
      faq: [{ question: "Co to je?", answer: "Zločin." }],
      tiles: [
        {
          resources: [{ title: "UNODC report", source: "UNODC", url: "https://www.unodc.org/x" }],
        },
      ],
      seo: {
        geoSummary: "Převaděčství je placená pomoc s nelegálním přechodem hranic.",
        keywords: [],
      },
    } as unknown as Encyclopedia;
    const markdown = articleMarkdown("entry", entry, atlas);
    expect(markdown).toContain(`- URL: ${SITE}/cs/entry/smuggling`);
    expect(markdown).toContain("- Autor: Redakce Atlasu");
    expect(markdown).toContain(
      "## Stručně\n\nPřevaděčství je placená pomoc s nelegálním přechodem hranic.",
    );
    expect(markdown).toContain("## Shrnutí\n\n- Bod jedna");
    expect(markdown).toContain("## Téma 1: Trasy\n\n- Moře\n\nText.");
    expect(markdown).toContain("## Otázky a odpovědi\n\n### Co to je?\n\nZločin.");
    expect(markdown).toContain(
      "## Zdroje a další čtení\n\n- [UNODC report](https://www.unodc.org/x) — UNODC",
    );
  });
});
