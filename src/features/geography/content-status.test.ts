import { describe, expect, it } from "vitest";
import { contentStatus, regionProgress, unprocessedCountries } from "./content-status";

describe("contentStatus", () => {
  it("keeps a known status and reads anything else as not started", () => {
    expect(contentStatus("ready")).toBe("ready");
    expect(contentStatus("preparing")).toBe("preparing");
    expect(contentStatus("none")).toBe("none");
    expect(contentStatus("done")).toBe("none");
    expect(contentStatus(undefined)).toBe("none");
    expect(contentStatus(null)).toBe("none");
  });
});

describe("regionProgress", () => {
  it("is completed only when the database says so, planned otherwise", () => {
    expect(regionProgress("completed")).toBe("completed");
    expect(regionProgress("planned")).toBe("planned");
    expect(regionProgress("ready")).toBe("planned");
    expect(regionProgress(undefined)).toBe("planned");
  });
});

describe("unprocessedCountries", () => {
  it("lists countries whose every group is still untouched", () => {
    expect(
      unprocessedCountries([
        { countries: ["IRN", "IRQ"], status: "ready" },
        { countries: ["UKR", "POL"], status: "preparing" },
        { countries: ["BRA", "ARG"], status: "none" },
      ]),
    ).toEqual(["ARG", "BRA"]);
  });

  it("a country in any started group stays lit", () => {
    // Migration covers the world and is untouched; the war issue is in preparation.
    expect(
      unprocessedCountries([
        { countries: ["UKR", "RUS", "USA", "BRA"], status: "none" },
        { countries: ["UKR", "RUS"], status: "preparing" },
      ]),
    ).toEqual(["BRA", "USA"]);
  });

  it("greys the countries of planned regions, not of completed ones", () => {
    expect(
      unprocessedCountries([
        { countries: ["EGY", "IRN"], status: "completed" },
        { countries: ["UKR", "KAZ"], status: "planned" },
      ]),
    ).toEqual(["KAZ", "UKR"]);
  });

  it("nothing to grey without groups", () => {
    expect(unprocessedCountries([])).toEqual([]);
  });
});
