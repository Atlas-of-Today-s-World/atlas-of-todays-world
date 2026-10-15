import { describe, expect, it } from "vitest";
import { MAP_ICON_GROUPS, MAP_ICON_NAMES } from "./icon-names";
import { MAP_ICONS } from "./icons";

describe("map icons", () => {
  it("has a component for exactly the curated names, about a hundred of them", () => {
    expect(Object.keys(MAP_ICONS).sort()).toEqual([...MAP_ICON_NAMES].sort());
    expect(MAP_ICON_NAMES.length).toBeGreaterThanOrEqual(90);
    expect(MAP_ICON_NAMES.length).toBeLessThanOrEqual(110);
  });

  it("lists each icon once, in one group", () => {
    expect(new Set(MAP_ICON_NAMES).size).toBe(MAP_ICON_NAMES.length);
    expect(Object.values(MAP_ICON_GROUPS).flat()).toEqual(MAP_ICON_NAMES);
  });

  it("covers the subjects editors map", () => {
    for (const name of [
      "map-pin",
      "flag",
      "landmark",
      "factory",
      "hospital",
      "plane",
      "ship",
      "train-front",
      "fuel",
      "zap",
      "bomb",
      "crosshair",
      "siren",
      "swords",
      "shield-alert",
      "skull",
      "flame",
      "triangle-alert",
      "tent",
      "users",
      "droplets",
      "waves",
      "mountain",
      "wheat",
      "tree-pine",
      "cloud-lightning",
    ]) {
      expect(MAP_ICON_NAMES).toContain(name);
    }
  });
});
