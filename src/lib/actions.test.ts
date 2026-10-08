import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn() }));

const { formObject } = await import("./actions");

describe("formObject", () => {
  it("reads fields, repeated fields as arrays and skips React's internal ones", () => {
    const form = new FormData();
    form.set("name", "Sahel");
    form.append("tags", "a");
    form.append("tags", "b");
    form.set("$ACTION_ID_x", "");
    expect(formObject(form, ["tags", "empty"])).toEqual({
      name: "Sahel",
      tags: ["a", "b"],
      empty: [],
    });
  });

  it("never lets a field name reach the prototype", () => {
    const form = new FormData();
    form.set("__proto__", new File(["x"], "x.txt"));
    form.set("constructor", "x");
    form.set("prototype", "x");
    form.set("name", "ok");
    const out = formObject(form);
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(Object.keys(out)).toEqual(["name"]);
    expect(out.constructor).toBe(Object);
  });
});
