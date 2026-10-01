import type { FilterOption, StatDef } from "./types";

/**
 * KPI chips "All" + one chip per option of a badge column (status, type…).
 * Server-safe helper for pages; the counts are computed by the table.
 */
export function optionStats<K extends string>(
  column: K,
  options: readonly FilterOption[],
  all = "All",
): StatDef<K>[] {
  return [
    { key: "all", label: all },
    ...options.map((option) => ({
      key: option.value,
      label: option.label,
      tone: option.tone,
      column,
      value: option.value,
    })),
  ];
}
