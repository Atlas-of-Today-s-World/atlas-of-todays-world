import { describe, expect, it } from "vitest";
import { addGroup, removeGroup } from "./country-groups";

const known = new Set(["CZE", "POL", "SVK", "HUN", "UKR"]);

describe("addGroup", () => {
  it("appends the group's new countries in its order, each once", () => {
    expect(addGroup(["UKR", "POL"], ["CZE", "POL", "SVK", "CZE"], known)).toEqual({
      selected: ["UKR", "POL", "CZE", "SVK"],
      changed: 2,
    });
  });

  it("leaves out countries the picker doesn't offer", () => {
    expect(addGroup([], ["CZE", "XKX"], known)).toEqual({ selected: ["CZE"], changed: 1 });
    expect(addGroup(["CZE"], ["CZE"], known)).toEqual({ selected: ["CZE"], changed: 0 });
  });
});

describe("removeGroup", () => {
  it("takes out every country of the group, keeping the rest in order", () => {
    expect(removeGroup(["UKR", "CZE", "POL", "HUN"], ["POL", "CZE", "SVK"])).toEqual({
      selected: ["UKR", "HUN"],
      changed: 2,
    });
    expect(removeGroup(["UKR"], ["CZE"])).toEqual({ selected: ["UKR"], changed: 0 });
  });
});
