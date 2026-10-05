import { describe, expect, it } from "vitest";
import { MINI_GLOBE } from "@/config/layout";
import { miniGlobeZoom } from "./home-location";

/** Globe diameter in px at a MapLibre zoom (circumference 512·2^zoom). */
const diameterAt = (zoom: number) => (512 * 2 ** zoom) / Math.PI;

describe("mini globe window", () => {
  it("fits the whole globe inside the window on phones and desktops", () => {
    const phone = diameterAt(miniGlobeZoom(390));
    const desktop = diameterAt(miniGlobeZoom(1440));
    expect(phone).toBeLessThan(MINI_GLOBE.mobile.height);
    expect(phone).toBeGreaterThan(MINI_GLOBE.mobile.height * 0.8);
    expect(desktop).toBeLessThan(MINI_GLOBE.desktop.height);
    expect(desktop).toBeGreaterThan(MINI_GLOBE.desktop.height * 0.8);
  });
});
