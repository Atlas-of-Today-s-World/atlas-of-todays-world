import { describe, expect, it } from "vitest";
import { badgeNumbers, countTopics, type TopicPlace } from "./map-counts";

const ALL = ["countries", "regions", "issues"] as const;
const groups = {
  regionOf: { CZE: "europe", DEU: "europe", SYR: "mena" },
  issues: [{ slug: "migration-routes", countries: ["SYR", "DEU"] }],
};

const topic = (slug: string, place: Partial<TopicPlace>): TopicPlace => ({
  slug,
  title: slug,
  region: null,
  issue: null,
  countries: [],
  layers: ALL,
  ...place,
});

describe("topic counts on the globe", () => {
  it("a country counts its own topic and the topic of its region (Czechia = 2)", () => {
    const counts = countTopics(
      [topic("europe-energy", { region: "europe" }), topic("czech-coal", { countries: ["CZE"] })],
      groups,
    );
    expect(counts.countries.CZE).toEqual(["europe-energy", "czech-coal"]);
    expect(counts.countries.DEU).toEqual(["europe-energy"]);
    expect(counts.regions).toEqual({ europe: ["europe-energy"] });
  });

  it("a global issue's topic counts for the group and each of its countries", () => {
    const counts = countTopics([topic("smuggling", { issue: "migration-routes" })], groups);
    expect(badgeNumbers(counts.issues)).toEqual({ "migration-routes": 1 });
    expect(Object.keys(counts.countries).sort()).toEqual(["DEU", "SYR"]);
  });

  it("a topic counts only on the layers it is shown on", () => {
    const counts = countTopics(
      [topic("europe-only", { region: "europe", layers: ["regions"] })],
      groups,
    );
    expect(counts.regions).toEqual({ europe: ["europe-only"] });
    expect(counts.countries).toEqual({});
  });

  it("a topic placed twice on the same country counts once", () => {
    const counts = countTopics([topic("both", { region: "europe", countries: ["CZE"] })], groups);
    expect(badgeNumbers(counts.countries)).toEqual({ CZE: 1, DEU: 1 });
  });
});
