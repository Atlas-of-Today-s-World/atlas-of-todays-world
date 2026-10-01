"use client";

import { useCallback, useSyncExternalStore } from "react";
import { createPreferencesStore } from "./preferences";
import type { TablePreferences } from "./types";

const store = createPreferencesStore(() =>
  typeof window === "undefined" ? null : window.localStorage,
);

/**
 * Preferences of one table. On the server and during hydration the hook
 * returns `defaults` (pass a memoised object), then the saved ones.
 */
export function useTablePreferences(
  tableKey: string,
  defaults: TablePreferences,
): [TablePreferences, (patch: Partial<TablePreferences>) => void, () => void] {
  const prefs = useSyncExternalStore(
    useCallback((listener) => store.subscribe(tableKey, listener), [tableKey]),
    () => store.get(tableKey, defaults),
    () => defaults,
  );
  const update = useCallback(
    (patch: Partial<TablePreferences>) => store.update(tableKey, defaults, patch),
    [tableKey, defaults],
  );
  const reset = useCallback(() => store.reset(tableKey), [tableKey]);
  return [prefs, update, reset];
}
