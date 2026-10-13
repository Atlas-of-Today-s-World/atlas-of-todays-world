import { describe, expect, it } from "vitest";
import type { MapFocusState } from "./MapContext";
import { sameFocus } from "./same-focus";

const focus = (overrides: Partial<MapFocusState> = {}): MapFocusState => ({
  center: [15, 50],
  zoom: 3.2,
  bbox: [12, 48, 19, 51],
  activeIso3: "CZE",
  regionCountries: ["AUT", "CZE", "DEU"],
  regionStroke: "#336699",
  ...overrides,
});

describe("sameFocus", () => {
  it("treats fresh arrays with the same values as the same focus", () => {
    expect(sameFocus(focus(), focus())).toBe(true);
  });

  it("tells apart regions with as many countries but different ones", () => {
    expect(sameFocus(focus(), focus({ regionCountries: ["AUT", "CZE", "POL"] }))).toBe(false);
  });

  it("tells apart the same countries in another order", () => {
    expect(sameFocus(focus(), focus({ regionCountries: ["DEU", "CZE", "AUT"] }))).toBe(false);
  });

  it("tells apart a different number of countries", () => {
    expect(sameFocus(focus(), focus({ regionCountries: ["AUT", "CZE"] }))).toBe(false);
  });

  it("compares the other fields too", () => {
    expect(sameFocus(focus(), focus({ center: [15, 51] }))).toBe(false);
    expect(sameFocus(focus(), focus({ zoom: 4 }))).toBe(false);
    expect(sameFocus(focus(), focus({ bbox: null }))).toBe(false);
    expect(sameFocus(focus(), focus({ activeIso3: null }))).toBe(false);
    expect(sameFocus(focus(), focus({ regionStroke: "#000000" }))).toBe(false);
  });
});
