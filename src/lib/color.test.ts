import { describe, expect, it } from "vitest";
import { saturate, saturateMap } from "./color";

describe("saturate", () => {
  it("factor 1 leaves the color unchanged", () => {
    expect(saturate("#3b4ce0", 1)).toBe("#3b4ce0");
  });

  it("factor 0 gives a grey of the same lightness", () => {
    const grey = saturate("#ff0000", 0);
    expect(grey).toMatch(/^#([0-9a-f]{2})\1\1$/);
  });

  it("preserves the hue and round-trips", () => {
    expect(saturate("#808080", 2)).toBe("#808080");
    expect(saturate("#cc3333", 1.0001)).toBe("#cc3333");
  });

  it("returns invalid input unchanged and converts the whole map", () => {
    expect(saturate("red", 0.5)).toBe("red");
    expect(Object.keys(saturateMap({ CZE: "#ff0000", DEU: "#00ff00" }, 0.5))).toEqual([
      "CZE",
      "DEU",
    ]);
  });
});
