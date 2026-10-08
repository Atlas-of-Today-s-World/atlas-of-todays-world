/**
 * One value of a query parameter from Next's `searchParams`. A repeated
 * parameter (`?q=a&q=b`) arrives as an array — the first value counts, so a
 * page never fails on it; a missing one is "".
 */
export function firstParam(value: string | string[] | null | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}
