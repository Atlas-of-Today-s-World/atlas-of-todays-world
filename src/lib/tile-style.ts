import type { CSSProperties } from "react";
import { cssBackgroundImage } from "@/lib/security/urls";

/** A colour as the admin stores it: `#rrggbb` (the DB CHECK is_hex_color says the same). */
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Inline background of a photo-or-colour tile (topic tiles, subtopic tiles on
 * the home map): the photo wins, otherwise the admin's colour; nothing when
 * neither is usable. The URL goes through the CSS escaping of
 * cssBackgroundImage, the colour must be a plain hex value.
 */
export function tileBackground(
  image: string | null | undefined,
  background: string | null | undefined,
  width?: number,
): CSSProperties | undefined {
  const photo = cssBackgroundImage(image, width);
  const style: CSSProperties = {};
  if (photo) style.backgroundImage = photo;
  if (background && HEX_COLOR.test(background)) style.backgroundColor = background;
  return photo || style.backgroundColor ? style : undefined;
}
