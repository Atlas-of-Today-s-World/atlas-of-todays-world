import { describe, expect, it } from "vitest";
import {
  excerpt,
  fold,
  htmlToText,
  queryWords,
  searchTopicTexts,
  type TopicText,
} from "./text-search";

const topics: TopicText[] = [
  {
    slug: "migrant-smuggling",
    title: "Migrant Smuggling",
    parts: [
      {
        anchor: null,
        heading: "Migrant Smuggling",
        text: "How moving people across borders works.",
      },
      {
        anchor: "topic-2",
        heading: "Smuggling Routes",
        text: "Boats leave the Libyan coast at night. Routes through Côte d'Ivoire and Niger shift with policy.",
      },
    ],
  },
  {
    slug: "sahel",
    title: "The Sahel",
    parts: [
      {
        anchor: "topic-1",
        heading: "Coups",
        text: "Niger saw a coup in 2023. Trade routes changed.",
      },
    ],
  },
];

const marked = (segments: { text: string; match: boolean }[]) =>
  segments.map((segment) => (segment.match ? `[${segment.text}]` : segment.text)).join("");

describe("topic text search", () => {
  it("folds case and accents without shifting positions", () => {
    expect(fold("Côte d'Ivoire")).toBe("cote d'ivoire");
    expect(fold("Žluťoučký").length).toBe("Žluťoučký".length);
  });

  it("turns sanitized HTML into plain text", () => {
    expect(htmlToText("<p>Rock &amp; roll</p><p>Next&nbsp;line&#8217;s</p>")).toBe(
      "Rock & roll Next line’s",
    );
  });

  it("needs every word, in the heading or the text", () => {
    expect(searchTopicTexts(topics, "cote niger").map((hit) => hit.anchor)).toEqual(["topic-2"]);
    expect(searchTopicTexts(topics, "routes libyan")[0]?.heading).toBe("Smuggling Routes");
    expect(
      searchTopicTexts(topics, "niger")
        .map((hit) => hit.slug)
        .sort(),
    ).toEqual(["migrant-smuggling", "sahel"]);
    expect(searchTopicTexts(topics, "x")).toEqual([]);
  });

  it("ranks heading matches first", () => {
    const hits = searchTopicTexts(topics, "routes");
    expect(hits.map((hit) => hit.slug)).toEqual(["migrant-smuggling", "sahel"]);
  });

  it("cuts the excerpt around the hit and marks every hit", () => {
    const text = `${"word ".repeat(60)}the Libyan coast ${"more ".repeat(80)}end`;
    const result = excerpt(text, queryWords("libyan"));
    expect(marked(result)).toMatch(/^… (word )+the \[Libyan\] coast (more )+…$/);
    expect(marked(excerpt("Côte and cote", ["cote"]))).toBe("[Côte] and [cote]");
  });
});
