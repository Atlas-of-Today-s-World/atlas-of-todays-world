import { describe, expect, it } from "vitest";
import { fold, markHits, queryWords } from "./text-search";

const marked = (segments: { text: string; match: boolean }[]) =>
  segments.map((segment) => (segment.match ? `[${segment.text}]` : segment.text)).join("");

describe("topic text search", () => {
  it("folds case and accents without shifting positions", () => {
    expect(fold("Côte d'Ivoire")).toBe("cote d'ivoire");
    expect(fold("Žluťoučký").length).toBe("Žluťoučký".length);
    // Letters NFD keeps whole fold like the database's fold_text().
    expect(fold("Łódź Đakovo Øresund Diyarbakır")).toBe("lodz dakovo oresund diyarbakir");
  });

  it("takes at least two-character words, each once, at most eight", () => {
    expect(queryWords("Côte d'Ivoire x")).toEqual(["cote", "ivoire"]);
    expect(queryWords("niger NIGER Niger")).toEqual(["niger"]);
    expect(queryWords("a'); drop table entries; --")).toEqual(["drop", "table", "entries"]);
    expect(queryWords("one two three four five six seven eight nine")).toHaveLength(8);
    expect(queryWords("x !")).toEqual([]);
  });

  it("marks every word that starts with a query word", () => {
    const words = queryWords("libyan cote");
    expect(marked(markHits("… the Libyan coast and Côte d'Ivoire, cote …", words))).toBe(
      "… the [Libyan] coast and [Côte] d'Ivoire, [cote] …",
    );
    // A prefix marks the start of the word, not a match inside another word.
    expect(marked(markHits("Routes and outroutes", ["rout"]))).toBe("[Rout]es and outroutes");
    // The longest word wins where two start at the same place.
    expect(marked(markHits("routes", ["ro", "routes"]))).toBe("[routes]");
    expect(markHits("no hit here", ["zz"])).toEqual([{ text: "no hit here", match: false }]);
    expect(markHits("", ["zz"])).toEqual([]);
  });
});
