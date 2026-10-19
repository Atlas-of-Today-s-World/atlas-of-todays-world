import { describe, expect, it } from "vitest";
import { labelZoomAt } from "./mapStyle";

describe("labelZoomAt", () => {
  it("is the whole zoom over Europe and south of it", () => {
    expect(labelZoomAt(2, 49.5)).toBe(2);
    expect(labelZoomAt(2.98, 35)).toBe(2);
    expect(labelZoomAt(2, 0)).toBe(2);
  });

  it("adds back what MapLibre takes off the zoom toward a pole", () => {
    // The home view (zoom 2 over Europe) turned north: the sphere keeps its size.
    expect(labelZoomAt(1.63, 60)).toBe(2);
    expect(labelZoomAt(-0.9, 85.08)).toBe(2);
    expect(labelZoomAt(-0.9, -85.08)).toBe(2);
  });

  it("doesn't drop a level on float noise at a whole zoom", () => {
    expect(labelZoomAt(2.9999999, 0)).toBe(3);
  });
});
