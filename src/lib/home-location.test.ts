import { describe, expect, it } from "vitest";
import { MINI_GLOBE } from "@/config/layout";
import { miniGlobeZoom } from "./home-location";
import { detectHomeCamera } from "./home-location-guess";

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

describe("home camera", () => {
  it("prefers the country of the IP address when the globe knows it", () => {
    const centers: Record<string, [number, number]> = { CZ: [15, 49.8], BR: [-52, -10] };
    expect(detectHomeCamera(centers, "BR")).toEqual({ center: [-52, -10], source: "ip" });
    // Unknown or missing IP country: the time zone / language / fallback decide.
    expect(detectHomeCamera(centers, "ZZ").source).not.toBe("ip");
    expect(detectHomeCamera(centers).source).not.toBe("ip");
  });
});
