import { describe, expect, it } from "vitest";
import { ilikeAny } from "./filters";

describe("ilikeAny", () => {
  it("builds one quoted ilike per column", () => {
    expect(ilikeAny(["email", "name"], " ana ")).toBe('email.ilike."%ana%",name.ilike."%ana%"');
  });

  it("drops filter syntax and wildcards, so a term can't break or widen the filter", () => {
    expect(ilikeAny(["title"], 'a%b_c,d(e)f"g\h')).toBe('title.ilike."%abcdefgh%"');
  });

  it("returns null for an empty term and caps a long one", () => {
    expect(ilikeAny(["title"], "  ")).toBeNull();
    expect(ilikeAny(["title"], undefined)).toBeNull();
    expect(ilikeAny(["title"], "x".repeat(300))).toBe(`title.ilike."%${"x".repeat(100)}%"`);
  });
});
