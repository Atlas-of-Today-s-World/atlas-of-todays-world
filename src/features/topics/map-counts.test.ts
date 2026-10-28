import { describe, expect, it } from "vitest";
import { badgeNumbers, countryBadges, countTopics, plannedPlaces } from "./map-counts";
import type { TopicPlace } from "@/features/entries/types";

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
    // The region also holds Czechia's own topic: never fewer than one of its countries.
    expect(counts.regions).toEqual({ europe: ["europe-energy", "czech-coal"] });
  });

  it("a region never counts fewer topics than any of its countries", () => {
    const counts = countTopics(
      [
        topic("europe-energy", { region: "europe" }),
        topic("czech-coal", { countries: ["CZE"] }),
        topic("smuggling", { issue: "migration-routes" }),
      ],
      groups,
    );
    const regionCount = (counts.regions.europe ?? []).length;
    for (const iso3 of ["CZE", "DEU"]) {
      expect(regionCount).toBeGreaterThanOrEqual((counts.countries[iso3] ?? []).length);
    }
    // A group holds topics placed on its countries.
    const groupCounts = countTopics([topic("syria-war", { countries: ["SYR"] })], groups);
    expect(groupCounts.issues["migration-routes"]).toEqual(["syria-war"]);
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

describe("country badges on the globe", () => {
  it("every country shows its region's count, not its own (2026-10-16)", () => {
    const counts = countTopics(
      [topic("europe-energy", { region: "europe" }), topic("czech-coal", { countries: ["CZE"] })],
      groups,
    );
    // Czechia has 2 topics of its own reach, Germany 1 — both draw Europe's 2.
    expect(countryBadges(counts.regions, groups.regionOf)).toEqual({ CZE: 2, DEU: 2 });
  });

  it("leaves out countries whose region has no topic or that have no region (the red 0)", () => {
    const counts = countTopics([topic("syria", { countries: ["SYR"] })], {
      ...groups,
      regionOf: { ...groups.regionOf, ATA: undefined },
    });
    expect(countryBadges(counts.regions, { ...groups.regionOf, ATA: undefined })).toEqual({
      SYR: 1,
    });
  });
});

describe("the entry plan on the globe", () => {
  it("counts planned topics by the same rules as published ones", () => {
    const planned = plannedPlaces([
      {
        title: "Alps",
        category: "Society",
        stage: "in_preparation",
        region: "europe",
        issue: null,
        countries: [],
      },
      {
        title: "Damascus",
        category: "Society",
        stage: "seeking_authors",
        region: null,
        issue: null,
        countries: ["SYR"],
      },
    ]);
    const plan = countTopics([topic("europe-energy", { region: "europe" }), ...planned], groups);
    expect(badgeNumbers(plan.regions)).toEqual({ europe: 2, mena: 1 });
    expect(countryBadges(plan.regions, groups.regionOf)).toEqual({ CZE: 2, DEU: 2, SYR: 1 });
  });

  it("keeps a planned topic of a global issue on that issue only", () => {
    const planned = plannedPlaces([
      {
        title: "Lives of refugees",
        category: "Society",
        stage: "seeking_authors",
        region: null,
        issue: "migration-routes",
        countries: ["SYR", "DEU"],
      },
    ]);
    const plan = countTopics(planned, {
      ...groups,
      issues: [...groups.issues, { slug: "eu-borders", countries: ["DEU"] }],
    });
    expect(plan.issues).toEqual({ "migration-routes": ["planned:0"] });
    expect(plan.regions).toEqual({});
    expect(plan.countries).toEqual({});
  });
});
