/**
 * Reading the `{ data, error }` a Supabase query or RPC resolves to, in one
 * place instead of `if (error) throw new Error(`[x] ${error.message}`)` after
 * every read. A failed read throws, so the page's error boundary shows it — a
 * database error never turns into an empty list or a 404.
 *
 * For mutations in Server Actions keep returning `failed(error)` (lib/actions):
 * the user gets a message, nothing throws.
 */

interface DbError {
  message: string;
}

/** Any query result: Supabase's success/failure union, or a plain `{ data, error }`. */
interface DbResult {
  data: unknown;
  error: DbError | null;
}

/** `data` of the success branch (`Row[]`, `Row | null` for `maybeSingle()`…). */
type DataOf<R extends DbResult> = [Extract<R, { error: null }>] extends [never]
  ? R["data"]
  : Extract<R, { error: null }>["data"];

/** Throws `[scope] message` when the read failed, otherwise returns its data. */
export function must<R extends DbResult>(result: R, scope: string): DataOf<R> {
  if (result.error) throw new Error(`[${scope}] ${result.error.message}`);
  return result.data as DataOf<R>;
}

/** Like `must` for lists: the rows, `[]` when the query returned no data. */
export function rowsOf<R extends DbResult>(result: R, scope: string): NonNullable<DataOf<R>> {
  return (must(result, scope) ?? []) as NonNullable<DataOf<R>>;
}
