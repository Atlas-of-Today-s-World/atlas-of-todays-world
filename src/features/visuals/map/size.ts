/**
 * Size of a map spec as the database measures it — `octet_length(map_spec::text)`
 * of the jsonb column (visuals_map_spec_check): UTF-8 JSON with a space after
 * each `:` and `,`. Plain code without Zod: the schema and the builder's size
 * meter both use it.
 */

/** Separators Postgres writes with a space (`": "`, `", "`) in jsonb's text form. */
function separators(value: unknown): number {
  if (Array.isArray(value)) {
    return Math.max(value.length - 1, 0) + value.reduce((sum, item) => sum + separators(item), 0);
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.values(value);
    return (
      entries.length * 2 -
      Math.min(entries.length, 1) +
      entries.reduce((sum: number, item) => sum + separators(item), 0)
    );
  }
  return 0;
}

/** Bytes the value takes as stored jsonb text; null when it can't be written as JSON. */
export function storedBytes(value: unknown): number | null {
  try {
    const json = JSON.stringify(value);
    if (json === undefined) return null;
    return new TextEncoder().encode(json).length + separators(JSON.parse(json));
  } catch {
    return null;
  }
}
