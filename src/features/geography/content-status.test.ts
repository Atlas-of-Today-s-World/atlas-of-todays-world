import { describe, expect, it } from "vitest";
import { contentStatus, regionProgress } from "./content-status";

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
