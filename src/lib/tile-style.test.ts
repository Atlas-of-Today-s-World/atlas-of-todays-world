import { describe, expect, it } from "vitest";
import { tileBackground } from "./tile-style";

describe("tileBackground", () => {
  it("keeps a hex colour and drops anything else", () => {
    expect(tileBackground(null, "#1f3a5f")).toEqual({ backgroundColor: "#1f3a5f" });
    expect(tileBackground(null, "red;position:fixed")).toBeUndefined();
  });

  it("uses an https photo through the CSS escaping", () => {
    const style = tileBackground("https://example.org/a(1).jpg", null);
    expect(style?.backgroundImage).toBe('url("https://example.org/a%281%29.jpg")');
  });

  it("ignores a non-https photo", () => {
    expect(tileBackground("javascript:alert(1)", null)).toBeUndefined();
  });
});
