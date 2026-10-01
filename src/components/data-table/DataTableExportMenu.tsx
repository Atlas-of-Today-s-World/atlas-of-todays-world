"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckboxControl } from "@/components/ui/checkbox";
import { Popover } from "@/components/ui/popover";
import { csvFileName, downloadCsv, rowsToCsv } from "./csv";
import type { ColumnDef, DataTableRow } from "./types";

/**
 * "Export CSV": the rows currently on screen (after search, filters and
 * sort — all pages, not just the visible one), with the columns the user
 * ticks (default = visible columns). Built in the browser.
 */
export function DataTableExportMenu({
  columns,
  visibleKeys,
  rows,
  fileName,
}: {
  /** Exportable columns in the user's order. */
  columns: readonly ColumnDef[];
  visibleKeys: readonly string[];
  rows: readonly DataTableRow[];
  fileName: string;
}) {
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const selected = chosen ?? new Set(visibleKeys);
  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setChosen(next);
  };

  return (
    <Popover
      label="Export CSV"
      align="end"
      className="w-72"
      trigger={(props) => (
        <Button
          variant="outline"
          size="dense"
          {...props}
          onClick={() => {
            // Each opening starts from the columns that are visible now.
            setChosen(null);
            props.onClick();
          }}
        >
          <Download aria-hidden className="size-3.5" /> Export CSV
        </Button>
      )}
    >
      {(close) => (
        <>
          <div className="flex items-center justify-between px-2 pt-1 pb-2">
            <span className="text-[11px] font-medium tracking-wide text-[var(--color-ink-muted)] uppercase">
              Columns ({selected.size}/{columns.length})
            </span>
            <span className="flex gap-1 text-[12px]">
              <button
                type="button"
                className="text-[var(--color-link)] hover:underline"
                onClick={() => setChosen(new Set(columns.map((column) => column.key)))}
              >
                All
              </button>
              ·
              <button
                type="button"
                className="text-[var(--color-link)] hover:underline"
                onClick={() => setChosen(new Set())}
              >
                None
              </button>
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--color-line)]">
            {columns.map((column) => (
              <label
                key={column.key}
                className="flex min-h-8 cursor-pointer items-center gap-2 px-2 text-[12.5px] hover:bg-[var(--color-line)]/50 pointer-coarse:min-h-(--touch-min)"
              >
                <CheckboxControl
                  aria-label={column.label}
                  checked={selected.has(column.key)}
                  onChange={() => toggle(column.key)}
                />
                <span className="truncate">{column.label}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 px-1 pt-2">
            <span className="text-[12px] text-[var(--color-ink-muted)]">
              {rows.length} {rows.length === 1 ? "row" : "rows"}
            </span>
            <Button
              size="dense"
              disabled={!selected.size || !rows.length}
              onClick={() => {
                const picked = columns.filter((column) => selected.has(column.key));
                downloadCsv(csvFileName(fileName), rowsToCsv(picked, rows));
                close();
              }}
            >
              <Download aria-hidden className="size-3.5" /> Download
            </Button>
          </div>
        </>
      )}
    </Popover>
  );
}
