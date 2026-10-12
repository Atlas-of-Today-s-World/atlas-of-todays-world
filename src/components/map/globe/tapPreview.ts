/**
 * Tap to preview on touch screens (useGlobeInteractions). A finger has no hover,
 * and small states are easy to hit by mistake, so the first tap on a place only
 * previews it (highlight + the label, which becomes a link); a second tap on the
 * same place opens it. A mouse keeps hover + click.
 */
export type TapStep = "preview" | "open" | "dismiss";

/**
 * What a tap does, given the place being previewed and the place tapped, each
 * as its target URL (a group's URL in group modes, so any of its countries
 * counts as the same place); null for nothing previewed / no place under the finger.
 */
export function tapStep(previewed: string | null, tapped: string | null): TapStep {
  if (tapped === null) return "dismiss";
  return tapped === previewed ? "open" : "preview";
}

/** Only a finger previews first; mouse and pen hover, so their click opens at once. */
export const isTouchPointer = (pointerType: string | null): boolean => pointerType === "touch";
