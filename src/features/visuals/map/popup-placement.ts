/**
 * Where a point's popup goes inside the map box. Narrow maps (phones) dock
 * it along the bottom edge at full width, so its text stays readable; wider
 * ones put it above the point (below when the point is near the top),
 * shifted sideways to stay inside the box. Pure — the renderer measures,
 * this decides.
 */

/** Below this map width the popup is docked at the bottom. */
export const DOCK_BELOW_PX = 480;
/** Gap between the popup and the map's edges. */
const EDGE = 8;

export type PopupPlacement =
  | { docked: true }
  | {
      docked: false;
      left: number;
      top: number;
      width: number;
      /** Above the point (the popup's bottom edge at `top`) or below it (its top edge at `top`). */
      above: boolean;
      maxHeight: number;
    };

export function placePopup({
  x,
  y,
  boxWidth,
  boxHeight,
  maxWidth,
  offset,
}: {
  /** The point on screen, relative to the map box. */
  x: number;
  y: number;
  boxWidth: number;
  boxHeight: number;
  /** The popup's widest setting. */
  maxWidth: number;
  /** Distance from the point's centre (its radius plus a gap). */
  offset: number;
}): PopupPlacement {
  if (boxWidth < DOCK_BELOW_PX) return { docked: true };
  const width = Math.min(maxWidth, boxWidth - 2 * EDGE);
  const left = Math.max(EDGE, Math.min(x - width / 2, boxWidth - width - EDGE));
  const above = y > boxHeight * 0.45;
  return above
    ? { docked: false, left, top: y - offset, width, above, maxHeight: y - offset - EDGE }
    : {
        docked: false,
        left,
        top: y + offset,
        width,
        above,
        maxHeight: boxHeight - y - offset - EDGE,
      };
}
