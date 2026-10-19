import { describe, expect, it } from "vitest";
import { clampFeaturedCount } from "./config";

describe("home featured count", () => {
  it("keeps 1–6 and falls back to 2", () => {
    expect(clampFeaturedCount(4)).toBe(4);
    expect(clampFeaturedCount(0)).toBe(1);
    expect(clampFeaturedCount(9)).toBe(6);
    expect(clampFeaturedCount(null)).toBe(2);
    expect(clampFeaturedCount(undefined)).toBe(2);
    expect(clampFeaturedCount(2.5)).toBe(2);
  });
});
