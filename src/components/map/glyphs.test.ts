import { describe, expect, it } from "vitest";
import { glyphRequestUrl, transformGlyphRequest } from "./glyphs";

// MapLibre types the resource kind as a const enum of these strings.
const transform = transformGlyphRequest as (url: string, kind: string) => unknown;

const ORIGIN = "https://atlas.example";

describe("map label glyphs", () => {
  it("keeps the ranges served with the site", () => {
    for (const range of ["0-255", "256-511", "512-767", "8192-8447"]) {
      const url = `${ORIGIN}/data/glyphs/Open%20Sans%20Regular/${range}.pbf`;
      expect(glyphRequestUrl(url)).toBe(url);
    }
  });

  it("sends any other range to fonts.openmaptiles.org", () => {
    expect(glyphRequestUrl(`${ORIGIN}/data/glyphs/Open%20Sans%20Semibold/1024-1279.pbf`)).toBe(
      "https://fonts.openmaptiles.org/Open%20Sans%20Semibold/1024-1279.pbf",
    );
  });

  it("touches only glyph requests", () => {
    const tile = "https://server.arcgisonline.com/tile/3/2/4";
    expect(transform(tile, "Tile")).toBeUndefined();
    expect(transform(`${ORIGIN}/data/glyphs/Open%20Sans%20Regular/0-255.pbf`, "Glyphs")).toEqual({
      url: `${ORIGIN}/data/glyphs/Open%20Sans%20Regular/0-255.pbf`,
    });
  });
});
