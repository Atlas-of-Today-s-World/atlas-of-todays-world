"use client";

import { ArrowDown, ArrowUp, Columns3, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckboxControl } from "@/components/ui/checkbox";
import { Popover } from "@/components/ui/popover";
import type { ColumnDef } from "./types";

/** Moves `key` one place up (-1) or down (+1) in the order. */
export function moveColumn(order: readonly string[], key: string, by: -1 | 1): string[] {
  const from = order.indexOf(key);
  const to = from + by;
  if (from < 0 || to < 0 || to >= order.length) return [...order];
  const next = [...order];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

/**
 * "Columns": show / hide and reorder. TealHub drags with dnd-kit; here the
 * order changes with up/down buttons — works from the keyboard and needs no
 * extra dependency.
 */
export function DataTableColumnsMenu({
  columns,
  order,
  hidden,
  onChange,
  onReset,
}: {
  columns: readonly ColumnDef[];
  order: string[];
  hidden: string[];
  onChange: (next: { order: string[]; hidden: string[] }) => void;
  onReset: () => void;
}) {
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const ordered = order.flatMap((key) => byKey.get(key) ?? []);
  const visibleCount = ordered.filter((column) => !hidden.includes(column.key)).length;

  const toggle = (key: string) =>
    onChange({
      order,
      hidden: hidden.includes(key) ? hidden.filter((item) => item !== key) : [...hidden, key],
    });

  return (
    <Popover
      label="Columns"
      align="end"
      trigger={(props) => (
        <Button variant="outline" size="dense" {...props}>
          <Columns3 aria-hidden className="size-3.5" /> Columns
        </Button>
      )}
    >
      <p className="px-2 pt-1 pb-2 text-[11px] font-medium tracking-wide text-[var(--color-ink-muted)] uppercase">
        Show and order
      </p>
      <ul className="max-h-[60vh] overflow-y-auto">
        {ordered.map((column, index) => {
          const shown = !hidden.includes(column.key);
          return (
            <li
              key={column.key}
              className="flex min-h-8 items-center gap-1 rounded-md pl-2 hover:bg-[var(--color-line)]/50"
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-[12.5px]">
                <CheckboxControl
                  aria-label={`Show ${column.label}`}
                  checked={shown}
                  // The last visible column cannot be hidden — an empty table helps nobody.
                  disabled={shown && visibleCount === 1}
                  onChange={() => toggle(column.key)}
                />
                <span className="truncate">{column.label}</span>
              </label>
              <Button
                variant="quiet"
                size="rowIcon"
                aria-label={`Move ${column.label} up`}
                disabled={index === 0}
                onClick={() => onChange({ order: moveColumn(order, column.key, -1), hidden })}
              >
                <ArrowUp aria-hidden className="size-3.5" />
              </Button>
              <Button
                variant="quiet"
                size="rowIcon"
                aria-label={`Move ${column.label} down`}
                disabled={index === ordered.length - 1}
                onClick={() => onChange({ order: moveColumn(order, column.key, 1), hidden })}
              >
                <ArrowDown aria-hidden className="size-3.5" />
              </Button>
            </li>
          );
        })}
      </ul>
      <Button variant="quiet" size="dense" onClick={onReset} className="mt-1 w-full">
        <RotateCcw aria-hidden className="size-3" /> Reset layout
      </Button>
    </Popover>
  );
}
