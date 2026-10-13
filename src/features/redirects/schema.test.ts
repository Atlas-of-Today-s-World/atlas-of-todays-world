import { describe, expect, it } from "vitest";
import {
  buildRedirectMap,
  matchRedirect,
  normalizePath,
  RedirectInput,
  RedirectUpdate,
} from "./schema";

const ok = (from_path: string, to_path: string) =>
  RedirectInput.safeParse({ from_path, to_path, permanent: "on" }).success;

describe("RedirectInput", () => {
  it("accepts paths on this site", () => {
    expect(ok("/news/old-slug", "/news/new-slug")).toBe(true);
    expect(ok("/blog/2024/post", "/news?tag=x#top")).toBe(true);
    const parsed = RedirectInput.parse({ from_path: " /a ", to_path: "/b" });
    expect(parsed).toEqual({ from_path: "/a", to_path: "/b", permanent: false });
  });

  it("rejects foreign domains, protocols and nonsense (open redirect)", () => {
    expect(ok("/old", "https://evil.example")).toBe(false);
    expect(ok("/old", "//evil.example")).toBe(false);
    expect(ok("/old", "/\\evil.example")).toBe(false);
    expect(ok("/old", "javascript:alert(1)")).toBe(false);
    expect(ok("old", "/new")).toBe(false);
    expect(ok("//old", "/new")).toBe(false);
  });

  it("source isn't the whole site, doesn't end with a slash and doesn't point to itself", () => {
    expect(ok("/", "/news")).toBe(false);
    expect(ok("/old/", "/news")).toBe(false);
    expect(ok("/same", "/same")).toBe(false);
  });
});

describe("RedirectUpdate", () => {
  const id = "4b1e1a52-2f4f-4f43-9a51-0d6c1c1f3a10";

  it("takes the same fields plus the redirect's id", () => {
    expect(
      RedirectUpdate.parse({ id, from_path: "/old", to_path: "/new", permanent: "on" }),
    ).toEqual({ id, from_path: "/old", to_path: "/new", permanent: true });
  });

  it("keeps every rule of a new redirect and needs a valid id", () => {
    const ok = (fields: Record<string, string>) => RedirectUpdate.safeParse(fields).success;
    expect(ok({ id, from_path: "/old", to_path: "https://evil.example" })).toBe(false);
    expect(ok({ id, from_path: "/same", to_path: "/same" })).toBe(false);
    expect(ok({ id, from_path: "/old/", to_path: "/new" })).toBe(false);
    expect(ok({ id: "1", from_path: "/old", to_path: "/new" })).toBe(false);
  });
});

describe("matchRedirect", () => {
  const map = buildRedirectMap([
    { from_path: "/news/old", to_path: "/news/new", permanent: true },
    { from_path: "/stránka", to_path: "/about", permanent: false },
  ]);

  it("finds the path even with a trailing slash and in encoded form", () => {
    expect(matchRedirect(map, "/news/old")).toEqual({ to: "/news/new", permanent: true });
    expect(matchRedirect(map, "/news/old/")).toEqual({ to: "/news/new", permanent: true });
    expect(matchRedirect(map, "/str%C3%A1nka")).toEqual({ to: "/about", permanent: false });
  });

  it("otherwise nothing (not even object properties)", () => {
    expect(matchRedirect(map, "/news/other")).toBeNull();
    expect(matchRedirect(map, "/constructor")).toBeNull();
    expect(matchRedirect(map, "/__proto__")).toBeNull();
  });

  it("normalizePath tolerates invalid encoding", () => {
    expect(normalizePath("/a%E0%A4%A")).toBe("/a%E0%A4%A");
    expect(normalizePath("/")).toBe("/");
  });
});
