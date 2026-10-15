import { describe, expect, it } from "vitest";
import {
  INLINE_STYLE_CLASSES,
  INLINE_TEXT_COLORS,
  INLINE_TEXT_SIZES,
  inlineStyleOf,
} from "./inline-styles";

describe("inline text styles", () => {
  it("lists one class per colour and size", () => {
    expect(INLINE_STYLE_CLASSES).toHaveLength(
      Object.keys(INLINE_TEXT_COLORS).length + Object.keys(INLINE_TEXT_SIZES).length,
    );
    expect(INLINE_STYLE_CLASSES).toContain("rt-color-red");
    expect(INLINE_STYLE_CLASSES).toContain("rt-size-large");
  });

  it("reads colour and size from the fixed sets only", () => {
    expect(inlineStyleOf("rt-color-blue rt-size-small")).toEqual({
      color: INLINE_TEXT_COLORS.blue,
      fontSize: INLINE_TEXT_SIZES.small,
    });
    expect(inlineStyleOf("rt-color-constructor rt-size-__proto__ rt-color- other")).toEqual({});
    expect(inlineStyleOf(null)).toEqual({});
    expect(inlineStyleOf(undefined)).toEqual({});
  });
});
