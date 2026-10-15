/**
 * Whole groups of countries in the country picker (a global issue assigned to
 * a region or a custom region): the group's countries are added to, or taken
 * out of, the selection one by one, so what is stored stays a plain list of
 * member countries (map highlight, topic counts and filters all read that).
 * Pure — the picker's buttons and the unit test share it.
 */

/** A region or custom region the picker can add or remove as a whole. */
export interface CountryGroupOption {
  key: string;
  name: string;
  /** ISO3 codes of its countries. */
  countries: readonly string[];
}

/**
 * `selected` plus the group's countries the picker knows, in the group's
 * order after the ones already chosen; nothing is added twice. Returns the
 * new list and how many countries it added.
 */
export function addGroup(
  selected: readonly string[],
  group: readonly string[],
  known: ReadonlySet<string>,
): { selected: string[]; changed: number } {
  const have = new Set(selected);
  const added = group.filter((iso3) => {
    if (have.has(iso3) || !known.has(iso3)) return false;
    have.add(iso3);
    return true;
  });
  return { selected: [...selected, ...added], changed: added.length };
}

/** `selected` without the group's countries, and how many it took out. */
export function removeGroup(
  selected: readonly string[],
  group: readonly string[],
): { selected: string[]; changed: number } {
  const drop = new Set(group);
  const kept = selected.filter((iso3) => !drop.has(iso3));
  return { selected: kept, changed: selected.length - kept.length };
}
