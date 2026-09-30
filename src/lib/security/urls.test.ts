import { describe, expect, it } from "vitest";
import { safeRedirect } from "./redirect";
import { cssBackgroundImage, safeUrl } from "./urls";

describe("safeUrl", () => {
  it.each([
    ["https://example.org/a.png", "https://example.org/a.png"],
    ["  https://example.org  ", "https://example.org/"],
    ["/region/mena", "/region/mena"],
  ])("povolí %s", (input, expected) => {
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
  ])("odmítne %s", (input) => {
    expect(safeUrl(input)).toBeNull();
  });

  it("mailto jen na vyžádání", () => {
    expect(safeUrl("mailto:a@b.cz", { allowMailto: true })).toBe("mailto:a@b.cz");
  });
});

describe("cssBackgroundImage", () => {
  it("obalí bezpečnou URL", () => {
    expect(cssBackgroundImage("https://x.org/a.jpg")).toBe('url("https://x.org/a.jpg")');
  });

  it("escapuje znaky, kterými by šlo z url() utéct", () => {
    const value = cssBackgroundImage('https://x.org/a.jpg?q=")");color:red;(') ?? "";
    // Uvnitř url("…") nesmí zůstat uvozovka ani závorka, kterou by šlo řetězec ukončit.
    expect(value.startsWith('url("') && value.endsWith('")')).toBe(true);
    expect(value.slice(5, -2)).not.toMatch(/["()]/);
  });

  it("nebezpečnou URL nevrátí", () => {
    expect(cssBackgroundImage("javascript:alert(1)")).toBeUndefined();
  });
});

describe("safeRedirect", () => {
  it.each(["/admin", "/admin/entries?id=1", "/"])("povolí %s", (target) => {
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
  ])("odmítne %s", (target) => {
    expect(safeRedirect(target, "/fallback")).toBe("/fallback");
  });

  it("ořízne mezery kolem", () => {
    expect(safeRedirect("  /admin  ")).toBe("/admin");
  });
});
