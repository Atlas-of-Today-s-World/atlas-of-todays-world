import type { FilterValue, SortState, TablePreferences } from "./types";

/**
 * Per-table preferences (column order, visibility, widths, sort, page size,
 * search, filters) kept in localStorage under `atlas:table:<key>`.
 *
 * A small external store rather than `useState` + effect: the hook reads it
 * through `useSyncExternalStore`, so the server and the first client render
 * use the defaults (no hydration mismatch), and two components showing the
 * same table (e.g. the table and a menu) never disagree.
 */

const PREFIX = "atlas:table:";
export const PAGE_SIZES = [25, 50, 100, 250] as const;

export function defaultPreferences(
  columnKeys: readonly string[],
  hidden: readonly string[] = [],
  sort: SortState | null = null,
  filters: Record<string, FilterValue> = {},
  pageSize = 50,
): TablePreferences {
  return {
    columnOrder: [...columnKeys],
    hiddenColumns: [...hidden],
    pageSize,
    sort,
    columnWidths: {},
    search: "",
    filters,
  };
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

function parseSort(value: unknown): SortState | null | undefined {
  if (value === null) return null;
  if (typeof value !== "object" || !value) return undefined;
  const { key, dir } = value as Record<string, unknown>;
  return typeof key === "string" && (dir === "asc" || dir === "desc") ? { key, dir } : undefined;
}

function parseFilters(value: unknown): Record<string, FilterValue> {
  if (typeof value !== "object" || !value) return {};
  const out: Record<string, FilterValue> = {};
  for (const [key, filter] of Object.entries(value)) {
    if (typeof filter === "string" || isStringArray(filter)) out[key] = filter;
  }
  return out;
}

function parseWidths(value: unknown): Record<string, number> {
  if (typeof value !== "object" || !value) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] > 0,
    ),
  );
}

/**
 * Stored JSON merged over the defaults. Anything malformed (an old version,
 * a hand edit) falls back to the default value of that field only.
 */
export function parsePreferences(raw: string | null, defaults: TablePreferences): TablePreferences {
  if (!raw) return defaults;
  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || !parsed) return defaults;
    data = parsed as Record<string, unknown>;
  } catch {
    return defaults;
  }
  const sort = parseSort(data.sort);
  return {
    columnOrder: reconcileOrder(
      isStringArray(data.columnOrder) ? data.columnOrder : defaults.columnOrder,
      defaults.columnOrder,
    ),
    hiddenColumns: isStringArray(data.hiddenColumns) ? data.hiddenColumns : defaults.hiddenColumns,
    pageSize: (PAGE_SIZES as readonly number[]).includes(data.pageSize as number)
      ? (data.pageSize as number)
      : defaults.pageSize,
    sort: sort === undefined ? defaults.sort : sort,
    columnWidths: parseWidths(data.columnWidths),
    search: typeof data.search === "string" ? data.search : defaults.search,
    filters: "filters" in data ? parseFilters(data.filters) : defaults.filters,
  };
}

/**
 * Saved column order against the columns the code defines now: removed
 * columns drop out, a new column is inserted after its left neighbour from
 * the definition (not at the end, where nobody would find it).
 */
export function reconcileOrder(saved: readonly string[], defined: readonly string[]): string[] {
  const known = new Set(defined);
  const next = saved.filter((key, index) => known.has(key) && saved.indexOf(key) === index);
  for (const key of defined) {
    if (next.includes(key)) continue;
    const index = defined.indexOf(key);
    let insertAt = 0;
    for (let i = index - 1; i >= 0; i--) {
      const position = next.indexOf(defined[i]!);
      if (position >= 0) {
        insertAt = position + 1;
        break;
      }
    }
    next.splice(insertAt, 0, key);
  }
  return next;
}

type Listener = () => void;

export interface PreferencesStore {
  get(tableKey: string, defaults: TablePreferences): TablePreferences;
  update(tableKey: string, defaults: TablePreferences, patch: Partial<TablePreferences>): void;
  reset(tableKey: string): void;
  subscribe(tableKey: string, listener: Listener): () => void;
}

/** Store over any `Storage` (localStorage in the browser, a fake in tests, none on the server). */
export function createPreferencesStore(storage: () => Storage | null): PreferencesStore {
  const cache = new Map<string, { defaults: TablePreferences; value: TablePreferences }>();
  const listeners = new Map<string, Set<Listener>>();
  const emit = (tableKey: string) => listeners.get(tableKey)?.forEach((listener) => listener());

  const read = (tableKey: string): string | null => {
    try {
      return storage()?.getItem(PREFIX + tableKey) ?? null;
    } catch {
      return null; // Blocked storage (private mode, policy) = defaults.
    }
  };

  const store: PreferencesStore = {
    get(tableKey, defaults) {
      const hit = cache.get(tableKey);
      if (hit && hit.defaults === defaults) return hit.value;
      const value = parsePreferences(read(tableKey), defaults);
      cache.set(tableKey, { defaults, value });
      return value;
    },
    update(tableKey, defaults, patch) {
      const value = { ...store.get(tableKey, defaults), ...patch };
      cache.set(tableKey, { defaults, value });
      try {
        storage()?.setItem(PREFIX + tableKey, JSON.stringify(value));
      } catch {
        /* Quota or blocked storage: keep the change for this visit only. */
      }
      emit(tableKey);
    },
    reset(tableKey) {
      cache.delete(tableKey);
      try {
        storage()?.removeItem(PREFIX + tableKey);
      } catch {
        /* ignore */
      }
      emit(tableKey);
    },
    subscribe(tableKey, listener) {
      if (!listeners.has(tableKey)) listeners.set(tableKey, new Set());
      listeners.get(tableKey)!.add(listener);
      return () => listeners.get(tableKey)?.delete(listener);
    },
  };
  return store;
}
