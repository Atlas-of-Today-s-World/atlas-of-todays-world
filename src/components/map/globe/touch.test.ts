import { describe, expect, it } from "vitest";
import type { StyleSpecification } from "maplibre-gl";
import { TOUCH_MAP_OPTIONS, doubleClickZooms, isTouchPointer, touchStyle } from "./touch";

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

describe("isTouchPointer", () => {
  it("is true only for a finger", () => {
    expect(isTouchPointer("touch")).toBe(true);
    expect(isTouchPointer("mouse")).toBe(false);
    expect(isTouchPointer("pen")).toBe(false);
    expect(isTouchPointer(null)).toBe(false);
  });
});

describe("doubleClickZooms", () => {
  it("turns double-tap zoom off for a finger, whose tap opens the place", () => {
    expect(doubleClickZooms("touch")).toBe(false);
  });

  it("keeps double-click zoom for a mouse and a pen", () => {
    expect(doubleClickZooms("mouse")).toBe(true);
    expect(doubleClickZooms("pen")).toBe(true);
  });

  it("keeps it before any pointer is known", () => {
    expect(doubleClickZooms(null)).toBe(true);
  });
});
