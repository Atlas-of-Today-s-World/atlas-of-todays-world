import { describe, expect, it } from "vitest";
import { saturate, saturateMap } from "./color";

describe("saturate", () => {
  it("s faktorem 1 barvu nemění", () => {
    expect(saturate("#3b4ce0", 1)).toBe("#3b4ce0");
  });

  it("faktor 0 dá šedou stejného jasu", () => {
    const grey = saturate("#ff0000", 0);
    expect(grey).toMatch(/^#([0-9a-f]{2})\1\1$/);
  });

  it("zachová odstín a zpětně se trefí", () => {
    expect(saturate("#808080", 2)).toBe("#808080");
    expect(saturate("#cc3333", 1.0001)).toBe("#cc3333");
  });

  it("neplatný vstup vrátí beze změny a mapu převede celou", () => {
    expect(saturate("red", 0.5)).toBe("red");
    expect(Object.keys(saturateMap({ CZE: "#ff0000", DEU: "#00ff00" }, 0.5))).toEqual([
      "CZE",
      "DEU",
    ]);
  });
});
