/**
 * Inline text styles of short rich texts (map point popups): a colour or a
 * size from a fixed set, written as a class on a `<span>` (`rt-color-red`,
 * `rt-size-large`) — never as a `style` attribute, so stored HTML carries no
 * CSS. The sanitizer keeps exactly these classes (lib/security/sanitize.ts);
 * the editor and the renderer turn them into colours and sizes from here.
 */

export const INLINE_TEXT_COLORS = {
  red: "#b91c1c",
  orange: "#c2410c",
  amber: "#a16207",
  green: "#15803d",
  teal: "#0f766e",
  blue: "#1d4ed8",
  violet: "#6d28d9",
  grey: "#646a82",
} as const;

export const INLINE_TEXT_SIZES = {
  small: "0.85em",
  large: "1.2em",
  huge: "1.45em",
} as const;

type InlineTextColor = keyof typeof INLINE_TEXT_COLORS;
type InlineTextSize = keyof typeof INLINE_TEXT_SIZES;

export const COLOR_CLASS_PREFIX = "rt-color-";
export const SIZE_CLASS_PREFIX = "rt-size-";

/** Every class an inline-styled `<span>` may keep. */
export const INLINE_STYLE_CLASSES: readonly string[] = [
  ...Object.keys(INLINE_TEXT_COLORS).map((name) => COLOR_CLASS_PREFIX + name),
  ...Object.keys(INLINE_TEXT_SIZES).map((name) => SIZE_CLASS_PREFIX + name),
];

const isColor = (name: string): name is InlineTextColor => Object.hasOwn(INLINE_TEXT_COLORS, name);
const isSize = (name: string): name is InlineTextSize => Object.hasOwn(INLINE_TEXT_SIZES, name);

/**
 * The colour and size a span's `class` stands for; unknown classes give
 * nothing (the value always comes from the fixed sets above).
 */
export function inlineStyleOf(className: string | null | undefined): {
  color?: string;
  fontSize?: string;
} {
  const style: { color?: string; fontSize?: string } = {};
  for (const name of (className ?? "").split(/\s+/)) {
    if (name.startsWith(COLOR_CLASS_PREFIX)) {
      const color = name.slice(COLOR_CLASS_PREFIX.length);
      if (isColor(color)) style.color = INLINE_TEXT_COLORS[color];
    } else if (name.startsWith(SIZE_CLASS_PREFIX)) {
      const size = name.slice(SIZE_CLASS_PREFIX.length);
      if (isSize(size)) style.fontSize = INLINE_TEXT_SIZES[size];
    }
  }
  return style;
}
