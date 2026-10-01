import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Úzký sloupec zarovnaný doprava (akce, čísla). */
  end?: boolean;
  /** Na úzkém displeji skrýt. */
  wide?: boolean;
}

/**
 * Jediná tabulka administrace (ARCHITEKTURA 15.1, D7). Vykresluje se na
 * serveru; filtrování a řazení jde přes URL parametry stránky, takže tabulka
 * sama nepotřebuje JavaScript.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  empty = "Nothing here yet.",
  caption,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  empty?: string;
  caption?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
      <table className="w-full text-left text-[13px]">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="bg-[var(--color-line)]/30 text-[12px] text-[var(--color-ink-muted)]">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`px-3 py-2.5 font-medium ${column.end ? "text-right" : ""} ${
                  column.wide ? "hidden md:table-cell" : ""
                }`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-t border-[var(--color-line)] align-middle">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-3 py-2 ${column.end ? "text-right whitespace-nowrap" : ""} ${
                    column.wide ? "hidden md:table-cell" : ""
                  }`}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-[var(--color-ink-muted)]">
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
