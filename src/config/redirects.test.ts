import { describe, expect, it } from "vitest";
import { BUILT_IN_REDIRECTS } from "./redirects";

describe("BUILT_IN_REDIRECTS", () => {
  const index = (source: string) => BUILT_IN_REDIRECTS.findIndex((rule) => rule.source === source);

  it("has one rule per source and paths on this site only", () => {
    const sources = BUILT_IN_REDIRECTS.map((rule) => rule.source);
    expect(new Set(sources).size).toBe(sources.length);
    for (const rule of BUILT_IN_REDIRECTS) {
      expect(rule.source).toMatch(/^\/[^/]/);
      expect(rule.destination).toMatch(/^\/(?!\/)/);
      expect(rule.reason).not.toBe("");
    }
  });

  it("puts specific paths before the general ones (first match wins)", () => {
    expect(index("/cs/:old(support|patrons)")).toBeLessThan(index("/cs/:path*"));
    expect(index("/entry/:slug.md")).toBeLessThan(index("/entry/:slug"));
    expect(index("/admin/obsah/novy")).toBeLessThan(index("/admin/obsah/:path*"));
    expect(index("/admin/regiony/zeme/:slug")).toBeLessThan(index("/admin/regiony/:path*"));
  });

  it("keeps old admin bookmarks inside the admin", () => {
    for (const rule of BUILT_IN_REDIRECTS.filter((r) => r.source.startsWith("/admin/"))) {
      expect(rule.destination).toMatch(/^\/admin\//);
    }
  });
});
