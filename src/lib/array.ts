/** New copy of the array with the items at indexes i and j swapped (out of range = unchanged). */
export function swap<T>(items: readonly T[], i: number, j: number): T[] {
  const a = items[i];
  const b = items[j];
  if (a === undefined || b === undefined) return [...items];
  const next = [...items];
  next[i] = b;
  next[j] = a;
  return next;
}
