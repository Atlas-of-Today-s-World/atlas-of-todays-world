/**
 * A colour as the admin stores it: `#rrggbb` (the DB CHECK is_hex_color says the
 * same). Its own module, without Zod, so client components (PhotoTile on the
 * map) can check a colour without pulling the form schemas into their bundle.
 */
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
