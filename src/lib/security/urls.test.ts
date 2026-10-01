import { describe, expect, it } from "vitest";
import { safeRedirect } from "./redirect";
import { cssBackgroundImage, safeUrl } from "./urls";

describe("safeUrl", () => {
  it.each([
    ["https://example.org/a.png", "https://example.org/a.png"],
    ["  https://example.org  ", "https://example.org/"],
    ["/region/mena", "/region/mena"],
  ])("allows %s", (input, expected) => {
    expect(safeUrl(input)).toBe(expected);
  });

  it.each([
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "http://example.org",
    "//evil.example/a.png",
    "/\\evil.example",
    "vbscript:msgbox(1)",
    "mailto:a@b.cz",
    "not a url",
    "",
    null,
    undefined,
    42,
  ])("rejects %s", (input) => {
    expect(safeUrl(input)).toBeNull();
  });

  it("mailto only on request", () => {
    expect(safeUrl("mailto:a@b.cz", { allowMailto: true })).toBe("mailto:a@b.cz");
  });
});

describe("cssBackgroundImage", () => {
  it("wraps a safe URL", () => {
    expect(cssBackgroundImage("https://x.org/a.jpg")).toBe('url("https://x.org/a.jpg")');
  });

  it("escapes characters that could break out of url()", () => {
    const value = cssBackgroundImage('https://x.org/a.jpg?q=")");color:red;(') ?? "";
    // Inside url("…") there must be no quote or parenthesis that could end the string.
    expect(value.startsWith('url("') && value.endsWith('")')).toBe(true);
    expect(value.slice(5, -2)).not.toMatch(/["()]/);
  });

  it("doesn't return an unsafe URL", () => {
    expect(cssBackgroundImage("javascript:alert(1)")).toBeUndefined();
  });
});

describe("safeRedirect", () => {
  it.each(["/admin", "/admin/entries?id=1", "/"])("allows %s", (target) => {
    expect(safeRedirect(target)).toBe(target);
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/a\\b",
    "javascript:alert(1)",
    "admin",
    "/admin\n",
    "",
    null,
    undefined,
  ])("rejects %s", (target) => {
    expect(safeRedirect(target, "/fallback")).toBe("/fallback");
  });

  it("trims surrounding whitespace", () => {
    expect(safeRedirect("  /admin  ")).toBe("/admin");
  });
});
