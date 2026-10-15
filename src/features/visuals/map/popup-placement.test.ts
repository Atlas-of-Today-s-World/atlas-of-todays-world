import { describe, expect, it } from "vitest";
import { DOCK_BELOW_PX, placePopup } from "./popup-placement";

const box = { boxWidth: 800, boxHeight: 450, maxWidth: 280, offset: 15 };

describe("placePopup", () => {
  it("docks along the bottom on a narrow map", () => {
    expect(placePopup({ ...box, x: 100, y: 100, boxWidth: DOCK_BELOW_PX - 1 })).toEqual({
      docked: true,
    });
  });

  it("sits above a point in the lower part, centred on it", () => {
    expect(placePopup({ ...box, x: 400, y: 300 })).toEqual({
      docked: false,
      left: 260,
      top: 285,
      width: 280,
      above: true,
      maxHeight: 277,
    });
  });

  it("goes below a point near the top", () => {
    expect(placePopup({ ...box, x: 400, y: 50 })).toMatchObject({
      above: false,
      top: 65,
      maxHeight: 377,
    });
  });

  it("stays inside the map sideways and is never wider than it", () => {
    expect(placePopup({ ...box, x: 5, y: 300 })).toMatchObject({ left: 8 });
    expect(placePopup({ ...box, x: 795, y: 300 })).toMatchObject({ left: 512 });
    expect(placePopup({ ...box, x: 300, y: 300, boxWidth: 500, maxWidth: 420 })).toMatchObject({
      width: 420,
      left: 72,
    });
    expect(placePopup({ ...box, x: 250, y: 300, boxWidth: 490, maxWidth: 480 })).toMatchObject({
      width: 474,
      left: 8,
    });
  });
});
