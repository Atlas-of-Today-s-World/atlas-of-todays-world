import { describe, expect, it } from "vitest";
import { diffParagraphs, paragraphs } from "./diff";

describe("paragraphs", () => {
  it("rozdělí HTML na odstavce a odstraní značky", () => {
    expect(
      paragraphs("<h2>Nadpis</h2><p>První &amp; <strong>druhý</strong></p><ul><li>A</li></ul>"),
    ).toEqual(["Nadpis", "První & druhý", "A"]);
  });
});

describe("diffParagraphs", () => {
  it("najde přidané, odebrané i beze změny", () => {
    expect(diffParagraphs(["a", "b", "c"], ["a", "x", "c", "d"])).toEqual([
      { type: "same", text: "a" },
      { type: "removed", text: "b" },
      { type: "added", text: "x" },
      { type: "same", text: "c" },
      { type: "added", text: "d" },
    ]);
  });

  it("zvládne prázdnou verzi", () => {
    expect(diffParagraphs([], ["a"])).toEqual([{ type: "added", text: "a" }]);
    expect(diffParagraphs(["a"], [])).toEqual([{ type: "removed", text: "a" }]);
  });
});
