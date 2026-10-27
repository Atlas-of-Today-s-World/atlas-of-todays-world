import { describe, expect, it } from "vitest";
import {
  SPIN_DEG_PER_SEC,
  isSpinEvent,
  slowStepWatch,
  spinLongitude,
  spinResumeAt,
  SPIN_EVENT,
  type SpinClock,
} from "./useIdleSpin";

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

describe("when the idle spin may turn", () => {
  const none = Number.NEGATIVE_INFINITY;
  const page = (overrides: Partial<NonNullable<SpinClock["touch"]>> = {}) => ({
    interacted: false,
    lastScrollAt: none,
    ...overrides,
  });

  it("desktop: after the start delay, and 5 s after the last input on the globe", () => {
    expect(spinResumeAt({ startAt: 3500, lastInputAt: none, touch: null })).toBe(3500);
    expect(spinResumeAt({ startAt: 3500, lastInputAt: 4000, touch: null })).toBe(9000);
  });

  it("touch: never turns before the visitor's first input on the page", () => {
    expect(spinResumeAt({ startAt: 3500, lastInputAt: none, touch: page() })).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it("touch: the first input ends that wait; the usual pause after it still applies", () => {
    const touch = page({ interacted: true });
    expect(spinResumeAt({ startAt: 3500, lastInputAt: none, touch })).toBe(3500);
    expect(spinResumeAt({ startAt: 3500, lastInputAt: 2000, touch })).toBe(7000);
  });

  it("touch: a scroll pauses it until the page has settled", () => {
    const touch = page({ interacted: true, lastScrollAt: 20_000 });
    expect(spinResumeAt({ startAt: 3500, lastInputAt: none, touch })).toBe(21_500);
  });

  it("touch: never earlier than desktop", () => {
    for (const lastInputAt of [none, 0, 5000, 30_000]) {
      for (const touch of [page(), page({ interacted: true }), page({ lastScrollAt: 9000 })]) {
        const desktop = spinResumeAt({ startAt: 3500, lastInputAt, touch: null });
        expect(spinResumeAt({ startAt: 3500, lastInputAt, touch })).toBeGreaterThanOrEqual(desktop);
      }
    }
  });
});

describe("slow devices stop the spin", () => {
  it("stops after three slow steps in a row", () => {
    const tooSlow = slowStepWatch();
    expect([400, 450, 500].map(tooSlow)).toEqual([false, false, true]);
  });

  it("a single slow step (a tab coming back, a GC) doesn't count", () => {
    const tooSlow = slowStepWatch();
    expect([33, 900, 34, 600, 35, 700, 33].map(tooSlow)).toEqual(Array(7).fill(false));
  });

  it("normal steps on phones (~80 ms) and desktops (~33 ms) never stop it", () => {
    const tooSlow = slowStepWatch();
    expect([80, 96, 81, 33, 50, 120].some(tooSlow)).toBe(false);
  });
});
