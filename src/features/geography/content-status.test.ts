import { describe, expect, it } from "vitest";
import { contentStatus, unprocessedCountries } from "./content-status";

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

  it("nothing to grey without groups", () => {
    expect(unprocessedCountries([])).toEqual([]);
  });
});
