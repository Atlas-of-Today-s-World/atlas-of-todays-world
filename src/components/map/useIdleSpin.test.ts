import { describe, expect, it } from "vitest";
import { SPIN_DEG_PER_SEC, isSpinEvent, spinLongitude, SPIN_EVENT } from "./useIdleSpin";

describe("idle globe spin", () => {
  it("moves the camera west at the set speed", () => {
    expect(spinLongitude(14, 1000)).toBeCloseTo(14 - SPIN_DEG_PER_SEC);
    expect(spinLongitude(14, 0)).toBe(14);
  });

  it("wraps around the antimeridian", () => {
    expect(spinLongitude(-179.5, 1000)).toBeCloseTo(179.5);
    expect(spinLongitude(180, 0)).toBe(-180);
  });

  it("is very slow: one turn takes minutes", () => {
    expect(360 / SPIN_DEG_PER_SEC).toBeGreaterThanOrEqual(180);
  });

  it("tags its own camera moves", () => {
    expect(isSpinEvent({ type: "movestart", ...SPIN_EVENT })).toBe(true);
    expect(isSpinEvent({ type: "movestart" })).toBe(false);
  });
});
