import { describe, expect, it } from "vitest";
import { FlagToggleInput } from "./schema";

describe("FlagToggleInput", () => {
  it("accepts a valid key and a boolean", () => {
    expect(FlagToggleInput.safeParse({ key: "maintenance", enabled: true }).success).toBe(true);
    expect(FlagToggleInput.safeParse({ key: "news_feed", enabled: false }).success).toBe(true);
  });

  it("refuses anything but a real boolean (a crafted action call)", () => {
    for (const enabled of ["true", 1, null, undefined, {}]) {
      expect(
        FlagToggleInput.safeParse({ key: "maintenance", enabled }).success,
        String(enabled),
      ).toBe(false);
    }
  });

  it("refuses a key the DB CHECK would refuse", () => {
    expect(FlagToggleInput.safeParse({ key: "Maintenance", enabled: true }).success).toBe(false);
  });
});
