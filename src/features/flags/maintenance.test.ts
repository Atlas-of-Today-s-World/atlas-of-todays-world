import { describe, expect, it } from "vitest";
import { maintenanceNotice } from "./maintenance";

const fallback = { title: "The Atlas is being updated", text: "Please come back later." };

describe("maintenanceNotice", () => {
  it("shows nothing while the switch is off, whatever is stored", () => {
    expect(maintenanceNotice(false, { title: "Down", text: "Upgrading" }, fallback)).toBeNull();
    expect(maintenanceNotice(false, null, fallback)).toBeNull();
  });

  it("uses the stored title and text when the switch is on", () => {
    expect(maintenanceNotice(true, { title: " Back soon ", text: "Upgrading." }, fallback)).toEqual(
      { title: "Back soon", text: "Upgrading." },
    );
  });

  it("falls back to the built-in wording for a missing or blank part", () => {
    expect(maintenanceNotice(true, null, fallback)).toEqual(fallback);
    expect(maintenanceNotice(true, { title: "", text: "  " }, fallback)).toEqual(fallback);
    expect(maintenanceNotice(true, { title: "Back soon" }, fallback)).toEqual({
      title: "Back soon",
      text: fallback.text,
    });
  });
});
