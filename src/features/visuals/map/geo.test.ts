import { describe, expect, it } from "vitest";
import { COUNTRY_BOXES, COUNTRY_OPTIONS } from "./country-data";
import {
  boundsFromView,
  boundsOfCountries,
  padBounds,
  pointPosition,
  toLngLatBounds,
  unionBounds,
} from "./geo";
import { IRAN_STRIKES_SAMPLE } from "./samples";
import type { MapBounds } from "./types";

describe("unionBounds", () => {
  it("is null for nothing and the box itself for one", () => {
    expect(unionBounds([])).toBeNull();
    expect(unionBounds([[10, 20, 30, 40]])).toEqual([10, 20, 30, 40]);
  });

  it("covers boxes side by side and overlapping", () => {
    expect(
      unionBounds([
        [34.2, 29.5, 35.7, 33.3],
        [34.9, 31.4, 35.6, 32.5],
        [35, 29, 39, 33.4],
      ]),
    ).toEqual([34.2, 29, 39, 33.4]);
    expect(
      unionBounds([
        [-10, 0, 0, 10],
        [20, -5, 30, 5],
      ]),
    ).toEqual([-10, -5, 30, 10]);
  });

  it("goes the short way across the antimeridian", () => {
    const russia: MapBounds = [27.35, 41.2, 180, 77.7];
    const alaska: MapBounds = [-180, 51.2, -129.9, 71.4];
    expect(unionBounds([russia, alaska])).toEqual([27.35, 41.2, 230.1, 77.7]);
    // Fiji and Samoa: a few degrees across the line, not the whole world.
    expect(
      unionBounds([
        [177, -19, 180, -16],
        [-180, -17, -178, -15],
        [-172.8, -14.1, -171.4, -13.4],
      ]),
    ).toEqual([177, -19, 188.6, -13.4]);
  });

  it("is the whole width when the boxes ring the globe", () => {
    expect(
      unionBounds([
        [-180, 0, 0, 10],
        [0, 0, 180, 10],
      ]),
    ).toEqual([-180, 0, 180, 10]);
    expect(unionBounds([[-180, -10, 180, 10]])).toEqual([-180, -10, 180, 10]);
    expect(unionBounds([[-200, -10, 200, 10]])).toEqual([-180, -10, 180, 10]);
  });
});

describe("padBounds", () => {
  it("adds a margin, at least half a degree, within the map's limits", () => {
    expect(padBounds([0, 0, 10, 10], 0.1)).toEqual([-1, -1, 11, 11]);
    expect(padBounds([14.2, 35.8, 14.6, 36.1], 0.08)).toEqual([13.7, 35.3, 15.1, 36.6]);
    expect(padBounds([-170, -84, 170, 84], 0.1)).toEqual([-180, -85, 180, 85]);
  });

  it("keeps a box across the antimeridian in the spec's form", () => {
    expect(padBounds([170, -20, 190, -10], 0.1)).toEqual([168, -21, 192, -9]);
    expect(padBounds([-185, 0, -175, 10], 0.1)).toEqual([174, -1, 186, 11]);
  });
});

describe("boundsOfCountries", () => {
  it("frames the countries with a margin and skips unknown codes", () => {
    expect(boundsOfCountries(["IRN"], COUNTRY_BOXES)).toEqual(IRAN_STRIKES_SAMPLE.view.bounds);
    const levant = boundsOfCountries(["ISR", "PSE", "XXX"], COUNTRY_BOXES);
    expect(levant?.[0]).toBeLessThan(34.25);
    expect(levant?.[2]).toBeGreaterThan(35.67);
    expect(boundsOfCountries(["XXX"], COUNTRY_BOXES)).toBeNull();
    expect(boundsOfCountries([], COUNTRY_BOXES)).toBeNull();
  });

  it("frames Russia with the United States across the Bering Strait", () => {
    const [west, , east] = boundsOfCountries(["RUS", "USA"], COUNTRY_BOXES) ?? [];
    expect(west).toBeGreaterThan(0);
    expect(east).toBeGreaterThan(180);
  });

  it("knows every country of the globe, named and boxed", () => {
    expect(COUNTRY_OPTIONS.length).toBeGreaterThan(200);
    for (const { iso3 } of COUNTRY_OPTIONS) {
      const [west, south, east, north] = COUNTRY_BOXES[iso3] ?? [];
      expect(west).toBeLessThanOrEqual(east!);
      expect(south).toBeLessThanOrEqual(north!);
    }
  });
});

describe("boundsFromView", () => {
  it("takes the map's bounds as they are inside one world", () => {
    expect(boundsFromView(10.123456, 20, 30, 40)).toEqual([10.1235, 20, 30, 40]);
  });

  it("brings a wrapped view back to west in [-180, 180)", () => {
    expect(boundsFromView(-200, 10, -150, 20)).toEqual([160, 10, 210, 20]);
    expect(boundsFromView(170, 10, 200, 20)).toEqual([170, 10, 200, 20]);
    expect(boundsFromView(190, 10, 200, 20)).toEqual([-170, 10, -160, 20]);
  });

  it("clamps a view wider than the world or past the poles", () => {
    expect(boundsFromView(-300, -89, 400, 89)).toEqual([-180, -85, 180, 85]);
  });
});

describe("helpers", () => {
  it("writes a box as MapLibre's corners", () => {
    expect(toLngLatBounds([1, 2, 3, 4])).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("keeps a dragged point on the map and rounds it", () => {
    expect(pointPosition(181.5, 88)).toEqual({ lat: 85, lon: -178.5 });
    expect(pointPosition(14.4378912345, 50.0755381234)).toEqual({ lat: 50.07554, lon: 14.43789 });
  });
});
