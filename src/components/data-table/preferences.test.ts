import { describe, expect, it, vi } from "vitest";
import { moveColumn } from "./DataTableColumnsMenu";
import {
  createPreferencesStore,
  defaultPreferences,
  parsePreferences,
  reconcileOrder,
} from "./preferences";
import { headerCheckboxState, toggleKey, togglePageSelection } from "./selection";

const defaults = defaultPreferences(["a", "b", "c"], ["c"], { key: "a", dir: "asc" });

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

describe("parsePreferences", () => {
  it("returns the defaults without saved data or with broken JSON", () => {
    expect(parsePreferences(null, defaults)).toBe(defaults);
    expect(parsePreferences("{oops", defaults)).toBe(defaults);
    expect(parsePreferences("42", defaults)).toBe(defaults);
  });

  it("keeps valid fields and drops malformed ones field by field", () => {
    const parsed = parsePreferences(
      JSON.stringify({
        columnOrder: ["c", "a", "b"],
        hiddenColumns: "nope",
        pageSize: 7,
        sort: { key: "b", dir: "sideways" },
        columnWidths: { a: 200, b: -5, c: "wide" },
        search: "moldova",
        filters: { a: "x", b: ["y"], c: 3 },
      }),
      defaults,
    );
    expect(parsed).toEqual({
      columnOrder: ["c", "a", "b"],
      hiddenColumns: ["c"],
      pageSize: 50,
      sort: { key: "a", dir: "asc" },
      columnWidths: { a: 200 },
      search: "moldova",
      filters: { a: "x", b: ["y"] },
    });
  });

  it("keeps an explicitly cleared sort", () => {
    expect(parsePreferences(JSON.stringify({ sort: null }), defaults).sort).toBeNull();
  });
});

describe("reconcileOrder", () => {
  it("drops removed columns and duplicates", () => {
    expect(reconcileOrder(["b", "x", "a", "b"], ["a", "b"])).toEqual(["b", "a"]);
  });

  it("inserts a new column after its left neighbour from the definition", () => {
    expect(reconcileOrder(["c", "a"], ["a", "new", "c"])).toEqual(["c", "a", "new"]);
    expect(reconcileOrder(["c", "a"], ["first", "a", "c"])).toEqual(["first", "c", "a"]);
  });
});

describe("preferences store", () => {
  it("reads defaults, saves updates and notifies subscribers", () => {
    const storage = fakeStorage();
    const store = createPreferencesStore(() => storage);
    const listener = vi.fn();
    store.subscribe("entries", listener);

    expect(store.get("entries", defaults)).toBe(defaults);
    store.update("entries", defaults, { pageSize: 100 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get("entries", defaults).pageSize).toBe(100);
    expect(JSON.parse(storage.getItem("atlas:table:entries")!).pageSize).toBe(100);
  });

  it("returns the same snapshot until something changes (useSyncExternalStore)", () => {
    const store = createPreferencesStore(() =>
      fakeStorage({ "atlas:table:t": JSON.stringify({ search: "x" }) }),
    );
    const first = store.get("t", defaults);
    expect(first.search).toBe("x");
    expect(store.get("t", defaults)).toBe(first);
  });

  it("reset forgets the saved preferences", () => {
    const storage = fakeStorage();
    const store = createPreferencesStore(() => storage);
    store.update("t", defaults, { search: "x" });
    store.reset("t");
    expect(storage.getItem("atlas:table:t")).toBeNull();
    expect(store.get("t", defaults)).toBe(defaults);
  });

  it("works without storage (server, blocked storage)", () => {
    const store = createPreferencesStore(() => null);
    store.update("t", defaults, { search: "x" });
    expect(store.get("t", defaults).search).toBe("x");

    const throwing = createPreferencesStore(() => {
      throw new Error("SecurityError");
    });
    expect(() => throwing.update("t", defaults, { search: "y" })).not.toThrow();
  });

  it("unsubscribes", () => {
    const store = createPreferencesStore(() => null);
    const listener = vi.fn();
    store.subscribe("t", listener)();
    store.update("t", defaults, { search: "x" });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("moveColumn", () => {
  it("swaps with the neighbour and ignores moves past the edges", () => {
    expect(moveColumn(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveColumn(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
    expect(moveColumn(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveColumn(["a", "b"], "zz", 1)).toEqual(["a", "b"]);
  });
});

describe("selection", () => {
  it("header checkbox selects the page, then clears it, keeping other pages", () => {
    const other = new Set(["x"]);
    const all = togglePageSelection(other, ["a", "b"]);
    expect([...all].sort()).toEqual(["a", "b", "x"]);
    expect([...togglePageSelection(all, ["a", "b"])]).toEqual(["x"]);
  });

  it("header checkbox state is tri-state", () => {
    expect(headerCheckboxState(new Set(), ["a", "b"])).toBe(false);
    expect(headerCheckboxState(new Set(["a"]), ["a", "b"])).toBe("indeterminate");
    expect(headerCheckboxState(new Set(["a", "b"]), ["a", "b"])).toBe(true);
    expect(headerCheckboxState(new Set(), [])).toBe(false);
  });

  it("toggleKey flips one row", () => {
    expect([...toggleKey(new Set(["a"]), "b")]).toEqual(["a", "b"]);
    expect([...toggleKey(new Set(["a"]), "a")]).toEqual([]);
  });
});
