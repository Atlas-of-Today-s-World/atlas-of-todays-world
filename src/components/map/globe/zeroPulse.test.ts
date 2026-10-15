import { describe, expect, it } from "vitest";
import { glowAt } from "./zeroPulse";

describe("glowAt", () => {
  it("grows from a small bright glow to a wide faded one within a pulse", () => {
    expect(glowAt(0)).toEqual({ radius: 7, opacity: 0.7 });
    expect(glowAt(1)).toEqual({ radius: 18, opacity: 0 });
    const mid = glowAt(0.5);
    expect(mid.radius).toBeGreaterThan(7);
    expect(mid.opacity).toBeGreaterThan(0);
  });

  it("stays within one pulse for any phase", () => {
    expect(glowAt(-1)).toEqual(glowAt(0));
    expect(glowAt(2)).toEqual(glowAt(1));
  });
});
