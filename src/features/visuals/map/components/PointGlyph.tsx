import { HEX_COLOR } from "@/lib/validation/hex-color";
import { MAP_ICONS } from "../icons";
import type { MapIconName } from "../types";

/** Below this diameter an icon would be an unreadable smudge: a plain disc instead. */
const MIN_ICON_SIZE = 12;
const FALLBACK_COLOR = "#646a82";

/** A colour from the spec as CSS, or the fallback when it isn't a plain #rrggbb. */
export const cssColor = (value: string | null | undefined, fallback = FALLBACK_COLOR) =>
  value && HEX_COLOR.test(value) ? value : fallback;

/**
 * How a point looks — on the map, in the legend and in the builder's list:
 * a disc in its colour with a white icon (or none), a white rim and, with
 * `pulse`, a ring that pulses (not at all with reduced motion). With no
 * colour (a legend item that is only an icon) the icon is drawn on its own.
 */
export function PointGlyph({
  color,
  size,
  icon,
  pulse = false,
}: {
  color: string | null;
  size: number;
  icon: MapIconName | null;
  pulse?: boolean;
}) {
  const Icon = icon ? MAP_ICONS[icon] : null;
  if (!color) {
    return Icon ? <Icon aria-hidden size={size} className="shrink-0" strokeWidth={2.25} /> : null;
  }
  const fill = cssColor(color);
  return (
    <span
      aria-hidden
      className="relative grid shrink-0 place-items-center rounded-full shadow-[0_0_0_2px_white,0_1px_4px_rgb(0_0_0/0.35)]"
      style={{ width: size, height: size, background: fill }}
    >
      {pulse ? (
        <span
          className="absolute inset-0 hidden rounded-full opacity-60 motion-safe:block motion-safe:animate-ping"
          style={{ background: fill }}
        />
      ) : null}
      {Icon && size >= MIN_ICON_SIZE ? (
        <Icon size={Math.round(size * 0.6)} color="white" strokeWidth={2.25} className="relative" />
      ) : null}
    </span>
  );
}
