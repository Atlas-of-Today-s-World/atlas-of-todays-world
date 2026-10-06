/**
 * PostgREST filter building for admin search boxes.
 *
 * A search term ends up inside an `.or()` filter string, where `,` `(` `)` and
 * `"` are syntax and `%` `_` are LIKE wildcards: they are removed (not escaped)
 * so a term can neither break the filter nor widen it. The value is quoted and
 * capped at 100 characters.
 */
export function ilikeAny(
  columns: readonly string[],
  term: string | null | undefined,
): string | null {
  const needle = term
    ?.trim()
    .replace(/[%_,()"\\]/g, "")
    .slice(0, 100);
  if (!needle) return null;
  return columns.map((column) => `${column}.ilike."%${needle}%"`).join(",");
}
