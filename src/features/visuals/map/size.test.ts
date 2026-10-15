import { describe, expect, it } from "vitest";
import { storedBytes } from "./size";

describe("storedBytes", () => {
  it("counts jsonb's text form, as octet_length(map_spec::text) does", () => {
    // Postgres: {"a": 1, "b": [1, 2], "c": {}, "d": []}
    expect(storedBytes({ a: 1, b: [1, 2], c: {}, d: [] })).toBe(
      '{"a": 1, "b": [1, 2], "c": {}, "d": []}'.length,
    );
    expect(storedBytes({ label: "Gaza ≈ 2" })).toBe('{"label": "Gaza ≈ 2"}'.length + 2);
    expect(storedBytes([])).toBe(2);
    expect(storedBytes("x")).toBe(3);
  });

  it("is null for what JSON can't hold", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(storedBytes(cyclic)).toBeNull();
    expect(storedBytes(undefined)).toBeNull();
    expect(storedBytes({ big: 1n })).toBeNull();
  });
});
