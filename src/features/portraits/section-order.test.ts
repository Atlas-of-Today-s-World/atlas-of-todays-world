import { describe, expect, it } from "vitest";
import { DEFAULT_SECTION_ORDER, SECTION_KEYS, normalizeSectionOrder } from "./section-order";

describe("normalizeSectionOrder", () => {
  it("keeps a valid order as it is", () => {
    const order = ["faq", "topics", "timeline", "resources", "visuals"];
    expect(normalizeSectionOrder(order)).toEqual(order);
  });

  it("falls back to the default for anything that is not a list", () => {
    expect(normalizeSectionOrder(null)).toEqual([...DEFAULT_SECTION_ORDER]);
    expect(normalizeSectionOrder("timeline")).toEqual([...DEFAULT_SECTION_ORDER]);
  });

  it("drops unknown keys and repeats", () => {
    expect(normalizeSectionOrder(["faq", "faq", "hero", "timeline"])).toEqual([
      "faq",
      "timeline",
      "topics",
      "visuals",
      "resources",
    ]);
  });

  it("appends sections the stored order does not know yet, in their default place", () => {
    expect(normalizeSectionOrder(["resources", "timeline"])).toEqual([
      "resources",
      "timeline",
      "topics",
      "visuals",
      "faq",
    ]);
  });

  it("always returns every section exactly once", () => {
    const result = normalizeSectionOrder(["visuals", 3, "x", "visuals"]);
    expect([...result].sort()).toEqual([...SECTION_KEYS].sort());
  });
});
