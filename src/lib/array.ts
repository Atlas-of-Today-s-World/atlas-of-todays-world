/** Nová kopie pole s prohozenými prvky na indexech i a j (mimo rozsah = beze změny). */
export function swap<T>(items: readonly T[], i: number, j: number): T[] {
  const a = items[i];
  const b = items[j];
  if (a === undefined || b === undefined) return [...items];
  const next = [...items];
  next[i] = b;
  next[j] = a;
  return next;
}
