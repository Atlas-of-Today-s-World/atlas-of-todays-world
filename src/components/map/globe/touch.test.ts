import { describe, expect, it } from "vitest";
import type { StyleSpecification } from "maplibre-gl";
import { TOUCH_MAP_OPTIONS, touchStyle } from "./touch";

describe("globe on touch screens", () => {
  it("drops the label fades and keeps a smaller tile cache", () => {
    expect(TOUCH_MAP_OPTIONS.fadeDuration).toBe(0);
    expect(TOUCH_MAP_OPTIONS.maxTileCacheSize).toBeGreaterThan(0);
    expect(TOUCH_MAP_OPTIONS.maxTileCacheSize).toBeLessThanOrEqual(100);
  });

  it("shows imagery tiles without a cross-fade, everything else unchanged", () => {
    const style: StyleSpecification = {
      version: 8,
      sources: { satellite: { type: "raster", tiles: ["https://tiles.example/{z}/{x}/{y}.jpg"] } },
      layers: [
        { id: "space", type: "background", paint: { "background-color": "#000" } },
        {
          id: "satellite",
          type: "raster",
          source: "satellite",
          paint: { "raster-opacity": 1, "raster-fade-duration": 200 },
        },
      ],
    };
    const touch = touchStyle(style);
    expect(touch.layers[0]).toBe(style.layers[0]);
    expect(touch.layers[1]).toMatchObject({
      paint: { "raster-opacity": 1, "raster-fade-duration": 0 },
    });
    // The desktop style object stays as it was.
    expect(style.layers[1]).toMatchObject({ paint: { "raster-fade-duration": 200 } });
  });
});
