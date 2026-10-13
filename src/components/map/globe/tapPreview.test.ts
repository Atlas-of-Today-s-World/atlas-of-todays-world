import { describe, expect, it } from "vitest";
import { doubleClickZooms, isTouchPointer, tapStep } from "./tapPreview";

describe("tapStep", () => {
  it("previews the first tapped place", () => {
    expect(tapStep(null, "/country/malta")).toBe("preview");
  });

  it("opens the place on a second tap", () => {
    expect(tapStep("/country/malta", "/country/malta")).toBe("open");
  });

  it("moves the preview to another place", () => {
    expect(tapStep("/country/malta", "/country/italy")).toBe("preview");
  });

  it("treats another country of the previewed group as the same place", () => {
    // Group modes key by the group URL, whichever member country was tapped.
    expect(tapStep("/region/southern-europe", "/region/southern-europe")).toBe("open");
  });

  it("dismisses the preview on a tap outside any place", () => {
    expect(tapStep("/country/malta", null)).toBe("dismiss");
    expect(tapStep(null, null)).toBe("dismiss");
  });

  it("walks a whole tap sequence", () => {
    let previewed: string | null = null;
    const steps: string[] = [];
    for (const tapped of [
      "/country/malta",
      "/country/italy",
      null,
      "/country/italy",
      "/country/italy",
    ]) {
      const step = tapStep(previewed, tapped);
      steps.push(step);
      previewed = step === "preview" ? tapped : null;
    }
    expect(steps).toEqual(["preview", "preview", "dismiss", "preview", "open"]);
  });
});

describe("isTouchPointer", () => {
  it("is true only for a finger", () => {
    expect(isTouchPointer("touch")).toBe(true);
    expect(isTouchPointer("mouse")).toBe(false);
    expect(isTouchPointer("pen")).toBe(false);
    expect(isTouchPointer(null)).toBe(false);
  });
});

describe("doubleClickZooms", () => {
  it("turns double-tap zoom off for a finger, whose double tap opens the place", () => {
    expect(doubleClickZooms("touch")).toBe(false);
  });

  it("keeps double-click zoom for a mouse and a pen", () => {
    expect(doubleClickZooms("mouse")).toBe(true);
    expect(doubleClickZooms("pen")).toBe(true);
  });

  it("keeps it before any pointer is known", () => {
    expect(doubleClickZooms(null)).toBe(true);
  });
});
