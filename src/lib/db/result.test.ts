import { describe, expect, it } from "vitest";
import { must, rowsOf } from "./result";

describe("must", () => {
  it("returns the data of a successful read", () => {
    expect(must({ data: [{ id: 1 }], error: null }, "x")).toEqual([{ id: 1 }]);
    expect(must({ data: null, error: null }, "x")).toBeNull();
  });

  it("throws the database message under the scope", () => {
    expect(() => must({ data: null, error: { message: "boom" } }, "entries")).toThrow(
      new Error("[entries] boom"),
    );
  });
});

describe("rowsOf", () => {
  it("returns the rows, or an empty list when there is no data", () => {
    expect(rowsOf({ data: [1, 2], error: null }, "x")).toEqual([1, 2]);
    expect(rowsOf({ data: null as number[] | null, error: null }, "x")).toEqual([]);
  });

  it("throws on a failed read instead of returning an empty list", () => {
    expect(() => rowsOf({ data: null, error: { message: "denied" } }, "roles")).toThrow(
      "[roles] denied",
    );
  });
});
