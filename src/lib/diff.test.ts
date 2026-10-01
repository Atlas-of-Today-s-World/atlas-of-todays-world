import { describe, expect, it } from "vitest";
import { diffParagraphs, paragraphs } from "./diff";

describe("paragraphs", () => {
  it("splits HTML into paragraphs and strips tags", () => {
    expect(
      paragraphs("<h2>Nadpis</h2><p>První &amp; <strong>druhý</strong></p><ul><li>A</li></ul>"),
    ).toEqual(["Nadpis", "První & druhý", "A"]);
  });
});

describe("diffParagraphs", () => {
  it("finds added, removed and unchanged paragraphs", () => {
    expect(diffParagraphs(["a", "b", "c"], ["a", "x", "c", "d"])).toEqual([
      { type: "same", text: "a" },
      { type: "removed", text: "b" },
      { type: "added", text: "x" },
      { type: "same", text: "c" },
      { type: "added", text: "d" },
    ]);
  });

  it("handles an empty version", () => {
    expect(diffParagraphs([], ["a"])).toEqual([{ type: "added", text: "a" }]);
    expect(diffParagraphs(["a"], [])).toEqual([{ type: "removed", text: "a" }]);
  });
});
