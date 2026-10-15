import { Mark } from "@tiptap/react";
import {
  COLOR_CLASS_PREFIX,
  INLINE_TEXT_COLORS,
  INLINE_TEXT_SIZES,
  SIZE_CLASS_PREFIX,
} from "@/lib/text/inline-styles";

/**
 * Colour and size of a stretch of text in short rich texts (map popups), as
 * TipTap marks over the fixed classes of lib/text/inline-styles. The editor
 * shows the colour inline; the sanitizer keeps only the class.
 */
function classMark(
  name: string,
  prefix: string,
  values: Readonly<Record<string, string>>,
  property: "color" | "font-size",
) {
  const valueOf = (element: HTMLElement): string | null => {
    for (const className of element.classList) {
      const value = className.slice(prefix.length);
      if (className.startsWith(prefix) && Object.hasOwn(values, value)) return value;
    }
    return null;
  };
  return Mark.create({
    name,
    addAttributes() {
      return {
        value: {
          default: null,
          parseHTML: valueOf,
          renderHTML: (attributes: { value?: string | null }) =>
            attributes.value && Object.hasOwn(values, attributes.value)
              ? {
                  class: prefix + attributes.value,
                  style: `${property}: ${values[attributes.value]}`,
                }
              : {},
        },
      };
    },
    parseHTML() {
      // Not consuming: a span with both a colour and a size class gets both marks.
      return [
        { tag: "span", consuming: false, getAttrs: (element) => (valueOf(element) ? null : false) },
      ];
    },
    renderHTML({ HTMLAttributes }) {
      return ["span", HTMLAttributes, 0];
    },
  });
}

export const TextColorMark = classMark(
  "textColor",
  COLOR_CLASS_PREFIX,
  INLINE_TEXT_COLORS,
  "color",
);
export const TextSizeMark = classMark(
  "textSize",
  SIZE_CLASS_PREFIX,
  INLINE_TEXT_SIZES,
  "font-size",
);
