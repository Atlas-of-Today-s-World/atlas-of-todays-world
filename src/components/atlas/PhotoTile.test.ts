import { describe, expect, it } from "vitest";
import { tileStyle } from "./PhotoTile";

describe("tileStyle", () => {
  it("keeps a hex colour and drops anything else", () => {
    expect(tileStyle(null, "#1f3a5f")).toEqual({ backgroundColor: "#1f3a5f" });
    expect(tileStyle(null, "red;position:fixed")).toBeUndefined();
  });

  it("uses an https photo through the CSS escaping", () => {
    const style = tileStyle("https://example.org/a(1).jpg", null);
    expect(style?.backgroundImage).toBe('url("https://example.org/a%281%29.jpg")');
  });

  it("ignores a non-https photo", () => {
    expect(tileStyle("javascript:alert(1)", null)).toBeUndefined();
  });
});
