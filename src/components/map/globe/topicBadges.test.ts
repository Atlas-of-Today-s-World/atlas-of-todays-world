import { describe, expect, it } from "vitest";
import { fractionText } from "./topicBadges";

describe("fractionText", () => {
  it("reads published / the region's whole entry plan, 0/0 for a place with neither", () => {
    expect(fractionText({ DEU: 7 }, { DEU: 10, MLI: 4 }, "iso3")).toEqual([
      "match",
      ["get", "iso3"],
      "DEU",
      "7/10",
      "MLI",
      "0/4",
      "0/0",
    ]);
    expect(fractionText({}, {}, "slug")).toEqual(["literal", "0/0"]);
  });

  it("never shows more published than planned", () => {
    expect(fractionText({ mena: 3 }, {}, "slug")).toEqual([
      "match",
      ["get", "slug"],
      "mena",
      "3/3",
      "0/0",
    ]);
  });
});
