import { describe, expect, it } from "vitest";
import { generateStars, TWINKLES } from "./stars";

describe("starfield", () => {
  it("is the same sky every time", () => {
    expect(generateStars(800, 600)).toEqual(generateStars(800, 600));
    expect(generateStars(800, 600, 1)).not.toEqual(generateStars(800, 600, 2));
  });

  it("scales the number of stars with the area, capped", () => {
    expect(generateStars(0, 0)).toEqual([]);
    expect(generateStars(1440, 900)).toHaveLength(589);
    expect(generateStars(20_000, 20_000)).toHaveLength(2400);
  });

  it("keeps existing stars in place when the field grows", () => {
    const small = generateStars(800, 600);
    expect(generateStars(1600, 1200).slice(0, small.length)).toEqual(small);
  });

  it("stays inside the field and subtle", () => {
    for (const star of generateStars(1920, 1080)) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThan(1);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThan(1);
      expect(star.r).toBeLessThanOrEqual(1.5);
      expect(star.alpha).toBeLessThanOrEqual(0.95);
    }
  });

  it("places the twinkling stars inside the field", () => {
    expect(TWINKLES.length).toBeGreaterThan(0);
    for (const star of TWINKLES) {
      expect(star.left).toBeGreaterThanOrEqual(0);
      expect(star.left).toBeLessThanOrEqual(100);
      expect(star.top).toBeGreaterThanOrEqual(0);
      expect(star.top).toBeLessThanOrEqual(100);
    }
  });
});
