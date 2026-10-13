import { describe, expect, it } from "vitest";
import { CategoryInput, IndicatorInput } from "./schema";

describe("CategoryInput", () => {
  const category = { label: "Closed autocracy", color: "#8C2F39" };

  it("a category value fits a Postgres integer", () => {
    for (const value of ["0", "-2147483648", "2147483647"]) {
      expect(CategoryInput.safeParse({ ...category, value }).success).toBe(true);
    }
    for (const value of ["2147483648", "-2147483649", "1.5"]) {
      expect(CategoryInput.safeParse({ ...category, value }).success).toBe(false);
    }
  });

  it("stores the colour lowercase", () => {
    expect(CategoryInput.parse({ ...category, value: "1" }).color).toBe("#8c2f39");
  });
});

describe("IndicatorInput", () => {
  const indicator = {
    id: "hdi",
    label: "Human Development Index",
    short_label: "HDI",
    description: "",
    unit: "",
    decimals: "3",
    source: "UNDP",
    source_url: "",
    type: "sequential",
    scale: "linear",
    domain_min: "0.4",
    domain_max: "0.96",
    ramp: ["#f2f7c4", "#41b6c4"],
  };

  it("type and scale come from the one list each", () => {
    expect(IndicatorInput.safeParse(indicator).success).toBe(true);
    expect(IndicatorInput.safeParse({ ...indicator, type: "diverging" }).success).toBe(false);
    expect(IndicatorInput.safeParse({ ...indicator, scale: "sqrt" }).success).toBe(false);
  });

  it("at most 9 palette colours (the DB CHECK on ramp says the same)", () => {
    const ramp = (count: number) => Array.from({ length: count }, () => "#aabbcc");
    expect(IndicatorInput.safeParse({ ...indicator, ramp: ramp(9) }).success).toBe(true);
    expect(IndicatorInput.safeParse({ ...indicator, ramp: ramp(10) }).success).toBe(false);
  });
});
