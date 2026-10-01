"use client";

import { Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

/**
 * The one bar above a table: search on the left with "Clear filters" next to
 * it, then page-specific toggles, Export CSV, Columns (TealHub layout). It has
 * no state of its own — the table owns search and preferences.
 */
export function DataTableToolbar({
  search,
  onSearch,
  placeholder = "Search…",
  label,
  activeFilters,
  onClear,
  children,
}: {
  search: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  /** Accessible name of the search field. */
  label: string;
  activeFilters: number;
  onClear: () => void;
  /** Right side: toggles, Export, Columns. */
  children?: ReactNode;
}) {
  const canClear = activeFilters > 0 || search.trim() !== "";
  const clearLabel = `Clear filters${activeFilters ? ` (${activeFilters})` : ""}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="search" className="relative min-w-[220px] flex-1 sm:max-w-md">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[var(--color-ink-muted)]"
        />
        <Input
          type="search"
          aria-label={label}
          placeholder={placeholder}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          className="h-8 min-h-8 rounded-full pl-8 text-[13px] pointer-coarse:min-h-(--touch-min)"
        />
      </div>
      {canClear ? (
        <Button variant="quiet" size="dense" onClick={onClear}>
          <X aria-hidden className="size-3" /> {clearLabel}
        </Button>
      ) : null}
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
