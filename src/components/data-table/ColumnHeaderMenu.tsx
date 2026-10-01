"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, Filter, Search, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckboxControl } from "@/components/ui/checkbox";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { isActiveFilter } from "./rows";
import type { ColumnDef, FilterOption, FilterValue, SortState } from "./types";

const searchInput =
  "h-8 w-full rounded-lg border border-[var(--color-line)] bg-white pr-2 pl-7 text-[12.5px] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-soft)] focus:outline-none pointer-coarse:h-(--touch-min)";

/**
 * Header cell content: the label is a sort button (asc → desc → off) and the
 * funnel opens the column filter. Two separate buttons, so both work from
 * the keyboard and the funnel is always visible (TealHub lesson: a filter
 * that shows only on hover is never found).
 */
export function ColumnHeaderMenu({
  column,
  sort,
  onSort,
  filter,
  onFilter,
  options,
}: {
  column: ColumnDef;
  sort: SortState | null;
  onSort: (next: SortState | null) => void;
  filter: FilterValue;
  onFilter: (value: FilterValue) => void;
  /** Options of a select filter (the column's or the distinct values). */
  options: FilterOption[];
}) {
  const sorted = sort?.key === column.key ? sort.dir : null;
  const SortIcon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronsUpDown;
  const active = isActiveFilter(filter);
  const canFilter = column.filter === "text" || column.filter === "select";
  const nextSort = (): SortState | null =>
    sorted === null
      ? { key: column.key, dir: "asc" }
      : sorted === "asc"
        ? { key: column.key, dir: "desc" }
        : null;

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-0.5",
        column.align === "right" && "justify-end",
        column.align === "center" && "justify-center",
      )}
    >
      {column.sortable ? (
        <button
          type="button"
          onClick={() => onSort(nextSort())}
          className={cn(
            "group flex min-w-0 items-center gap-1 rounded-md px-1 py-1 text-left uppercase hover:text-[var(--color-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none pointer-coarse:min-h-(--touch-min)",
            sorted && "text-[var(--color-ink)]",
          )}
        >
          <span className="truncate">{column.label}</span>
          <SortIcon
            aria-hidden
            className={cn(
              "size-3 shrink-0 transition-opacity",
              sorted ? "opacity-100" : "opacity-35 group-hover:opacity-80",
            )}
          />
        </button>
      ) : (
        <span className="truncate px-1 uppercase">{column.label}</span>
      )}
      {canFilter ? (
        <Popover
          label={`Filter ${column.label}`}
          align={column.align === "right" ? "end" : "start"}
          trigger={(props) => (
            <button
              type="button"
              {...props}
              aria-label={`Filter ${column.label}${active ? " (active)" : ""}`}
              title={`Filter ${column.label}`}
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-md transition hover:bg-[var(--color-line)] hover:text-[var(--color-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none pointer-coarse:size-(--touch-min)",
                active ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : "opacity-50",
              )}
            >
              <Filter aria-hidden className="size-3" />
            </button>
          )}
        >
          {(close) =>
            column.filter === "text" ? (
              <TextFilter column={column} filter={filter} onFilter={onFilter} close={close} />
            ) : (
              <SelectFilter column={column} filter={filter} onFilter={onFilter} options={options} />
            )
          }
        </Popover>
      ) : null}
    </div>
  );
}

function TextFilter({
  column,
  filter,
  onFilter,
  close,
}: {
  column: ColumnDef;
  filter: FilterValue;
  onFilter: (value: FilterValue) => void;
  close: () => void;
}) {
  return (
    <div className="relative">
      <Search
        aria-hidden
        className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-[var(--color-ink-muted)]"
      />
      <input
        type="search"
        aria-label={`Contains (${column.label})`}
        placeholder={`Search in ${column.label.toLowerCase()}…`}
        value={typeof filter === "string" ? filter : ""}
        onChange={(event) => onFilter(event.target.value || null)}
        onKeyDown={(event) => {
          if (event.key === "Enter") close();
        }}
        className={searchInput}
      />
    </div>
  );
}

function SelectFilter({
  column,
  filter,
  onFilter,
  options,
}: {
  column: ColumnDef;
  filter: FilterValue;
  onFilter: (value: FilterValue) => void;
  options: FilterOption[];
}) {
  const [query, setQuery] = useState("");
  const selected = Array.isArray(filter) ? filter : filter ? [filter] : [];
  const shown = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    onFilter(next.length ? next : null);
  };

  return (
    <div className="grid gap-1">
      {options.length > 6 ? (
        <div className="relative">
          <Search
            aria-hidden
            className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-[var(--color-ink-muted)]"
          />
          <input
            type="search"
            aria-label="Find option"
            placeholder="Find option…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={searchInput}
          />
        </div>
      ) : null}
      <fieldset className="max-h-56 overflow-y-auto">
        <legend className="sr-only">{column.label}</legend>
        {shown.map((option) => (
          <label
            key={option.value}
            className="flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[12.5px] hover:bg-[var(--color-line)]/60 pointer-coarse:min-h-(--touch-min)"
          >
            <CheckboxControl
              aria-label={option.label}
              checked={selected.includes(option.value)}
              onChange={() => toggle(option.value)}
            />
            <span className="truncate">{option.label}</span>
          </label>
        ))}
        {!shown.length ? (
          <p className="px-2 py-3 text-center text-[12px] text-[var(--color-ink-muted)]">
            No options
          </p>
        ) : null}
      </fieldset>
      {selected.length ? (
        <Button variant="quiet" size="dense" onClick={() => onFilter(null)} className="w-full">
          <X aria-hidden className="size-3" /> Clear selection
        </Button>
      ) : null}
    </div>
  );
}
