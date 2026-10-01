/**
 * Row selection rules (ported from TealHub).
 *
 * The header checkbox only ever acts on the rows shown on the current page,
 * never on the whole result — selecting hundreds of invisible rows for a bulk
 * action is a worse surprise than one more click. Selection survives paging.
 */

/** Selects the whole page, or clears it when all of it is selected already. */
export function togglePageSelection(
  selected: ReadonlySet<string>,
  pageKeys: readonly string[],
): Set<string> {
  const next = new Set(selected);
  const everySelected = pageKeys.length > 0 && pageKeys.every((key) => next.has(key));
  for (const key of pageKeys) {
    if (everySelected) next.delete(key);
    else next.add(key);
  }
  return next;
}

/** State of the header checkbox for the current page. */
export function headerCheckboxState(
  selected: ReadonlySet<string>,
  pageKeys: readonly string[],
): boolean | "indeterminate" {
  const count = pageKeys.filter((key) => selected.has(key)).length;
  if (pageKeys.length > 0 && count === pageKeys.length) return true;
  return count > 0 ? "indeterminate" : false;
}

/** Toggles one row, leaves the rest. */
export function toggleKey(selected: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(selected);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}
