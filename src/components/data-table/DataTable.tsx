"use client";

import { ChevronLeft, ChevronRight, Download, Inbox } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { CheckboxControl } from "@/components/ui/checkbox";
import { cn } from "@/lib/cn";
import { BulkActionBar } from "./BulkActionBar";
import { renderCell } from "./cells";
import { ColumnHeaderMenu } from "./ColumnHeaderMenu";
import { csvFileName, downloadCsv, rowsToCsv } from "./csv";
import { DataTableColumnsMenu } from "./DataTableColumnsMenu";
import { DataTableExportMenu } from "./DataTableExportMenu";
import { DataTableToolbar } from "./DataTableToolbar";
import { buildGridTemplate, columnTrack, MIN_COLUMN_PX } from "./gridTemplate";
import { defaultPreferences, PAGE_SIZES } from "./preferences";
import { activeFilterCount, countWhere, filterOptions, isActiveFilter, processRows } from "./rows";
import { headerCheckboxState, toggleKey, togglePageSelection } from "./selection";
import { StatChips, type StatChip } from "./StatChips";
import type {
  ColumnDef,
  DataTableRow,
  FilterValue,
  SortState,
  StatDef,
  TablePreferences,
} from "./types";
import { useTablePreferences } from "./useTablePreferences";

export interface DataTableProps<K extends string> {
  /** Key of the saved preferences (column order, widths, sort…), unique per list. */
  tableKey: string;
  /** Accessible name of the table; also the default CSV file name. */
  caption: string;
  columns: readonly ColumnDef<K>[];
  rows: readonly DataTableRow<K>[];
  initialSort?: SortState;
  /** Filters of a first visit (until the user changes or clears them). */
  initialFilters?: Record<string, string[]>;
  /** KPI chips above the toolbar. */
  stats?: readonly StatDef<K>[];
  /** Page-specific toggles in the toolbar, before Export / Columns. */
  toolbar?: ReactNode;
  searchPlaceholder?: string;
  /**
   * Mirror the search into this URL parameter (debounced), for lists the
   * server loads only partly — the page then filters in the database too.
   */
  searchParam?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Checkbox column + bar with the selection (Export selected). */
  selectable?: boolean;
  /** Width of the sticky Actions column (fixed track). */
  actionsWidth?: string;
  /** Short list in a card: no toolbar, no footer. */
  compact?: boolean;
  /**
   * Column filters from the URL (a dashboard link such as `?status=draft`),
   * applied once on arrival and then kept like any other filter.
   */
  seedFilters?: Record<string, string[]>;
}

const SEARCH_DEBOUNCE_MS = 350;
const RESIZE_STEP_PX = 16;

/**
 * The one table of the admin (ARCHITEKTURA 15.1), ported from TealHub's
 * DataTable: full-text search, sortable headers with a filter per column,
 * KPI chips, resizable / reorderable / hideable columns kept per user,
 * paging, row selection, CSV export of what is on screen and a sticky
 * Actions column. Rows are plain data from the (server) page.
 *
 * Semantics: a real <table> laid out as one CSS grid (header and body share
 * the template); rows and row groups use `display: contents`, so they carry
 * explicit roles to keep the table structure for assistive technology.
 */
export function DataTable<K extends string>({
  tableKey,
  caption,
  columns,
  rows,
  initialSort,
  initialFilters,
  stats,
  toolbar,
  searchPlaceholder,
  searchParam,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  selectable = false,
  actionsWidth = "96px",
  compact = false,
  seedFilters,
}: DataTableProps<K>) {
  const allColumns = columns as readonly ColumnDef[];
  const columnKeys = allColumns.map((column) => column.key).join("|");
  const initialFiltersKey = JSON.stringify(initialFilters ?? {});
  const defaults = useMemo<TablePreferences>(
    () =>
      defaultPreferences(
        columnKeys.split("|"),
        allColumns.filter((column) => column.hidden).map((column) => column.key),
        initialSort ?? null,
        JSON.parse(initialFiltersKey) as Record<string, string[]>,
      ),
    // Defaults depend on the column set, not on the identity of the array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnKeys, initialSort?.key, initialSort?.dir, initialFiltersKey],
  );
  const [prefs, setPrefs, resetPrefs] = useTablePreferences(tableKey, defaults);

  // Search: saved with the preferences, or mirrored into the URL (searchParam).
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [urlSearch, setUrlSearch] = useState(() => (searchParam && params.get(searchParam)) || "");
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const search = searchParam ? urlSearch : prefs.search;
  const setSearch = (value: string) => {
    if (!searchParam) return setPrefs({ search: value });
    setUrlSearch(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set(searchParam, value.trim());
      else next.delete(searchParam);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, SEARCH_DEBOUNCE_MS);
  };

  const seed = seedFilters && Object.keys(seedFilters).length ? JSON.stringify(seedFilters) : "";
  useEffect(() => {
    if (seed) setPrefs({ filters: JSON.parse(seed) as Record<string, string[]> });
    // Once per arrival with a seed; later changes belong to the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  const filters = prefs.filters;
  const setFilter = (key: string, value: FilterValue) =>
    setPrefs({ filters: { ...filters, [key]: value } });

  const byKey = new Map(allColumns.map((column) => [column.key, column]));
  const visible = prefs.columnOrder.flatMap((key) => {
    const column = byKey.get(key);
    return column && !prefs.hiddenColumns.includes(key) ? [column] : [];
  });

  const processed = useMemo(
    () => processRows({ rows, columns: allColumns, search, filters, sort: prefs.sort }),
    [rows, allColumns, search, filters, prefs.sort],
  );

  // Paging. The page index resets when the result shape changes.
  const [pageState, setPageState] = useState({ index: 0, shape: "" });
  const shape = `${search}|${JSON.stringify(filters)}|${prefs.pageSize}`;
  const pageCount = Math.max(1, Math.ceil(processed.length / prefs.pageSize));
  const page = pageState.shape === shape ? Math.min(pageState.index, pageCount - 1) : 0;
  const setPage = (index: number) => setPageState({ index, shape });
  const pageRows = processed.slice(page * prefs.pageSize, (page + 1) * prefs.pageSize);

  // Selection survives paging but is cleared when the filters change: keeping
  // rows ticked that the user can no longer see is how things get deleted.
  const [selection, setSelection] = useState({ keys: new Set<string>(), shape });
  const selected = selection.shape === shape ? selection.keys : new Set<string>();
  const setSelected = (keys: Set<string>) => setSelection({ keys, shape });
  const pageKeys = pageRows.map((row) => row.id);
  const headerState = headerCheckboxState(selected, pageKeys);
  const selectedRows = processed.filter((row) => selected.has(row.id));

  const hasActions = rows.some((row) => row.actions !== undefined);
  const template = buildGridTemplate({
    columnWidths: visible.map((column) =>
      columnTrack(column.width, prefs.columnWidths[column.key]),
    ),
    actionsWidth: hasActions ? actionsWidth : null,
    hasSelect: selectable,
  });

  // Column resizing (pointer + keyboard on the separator).
  const headerRow = useRef<HTMLTableRowElement>(null);
  const widthOf = (key: string) =>
    Math.round(
      headerRow.current
        ?.querySelector<HTMLElement>(`[data-col="${CSS.escape(key)}"]`)
        ?.getBoundingClientRect().width ?? 120,
    );
  /** Columns left of the resized one keep their current width (TealHub). */
  const frozenLeftOf = (key: string) => {
    const widths = { ...prefs.columnWidths };
    for (const column of visible.slice(
      0,
      visible.findIndex((item) => item.key === key),
    )) {
      widths[column.key] ??= widthOf(column.key);
    }
    return widths;
  };
  const startResize = (event: PointerEvent<HTMLElement>, key: string) => {
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = widthOf(key);
    const frozen = frozenLeftOf(key);
    const onMove = (move: globalThis.PointerEvent) =>
      setPrefs({
        columnWidths: {
          ...frozen,
          [key]: Math.max(MIN_COLUMN_PX, startWidth + move.clientX - startX),
        },
      });
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  };
  const keyResize = (event: KeyboardEvent<HTMLElement>, key: string) => {
    const step = { ArrowLeft: -RESIZE_STEP_PX, ArrowRight: RESIZE_STEP_PX }[event.key];
    if (step) {
      event.preventDefault();
      setPrefs({
        columnWidths: {
          ...frozenLeftOf(key),
          [key]: Math.max(MIN_COLUMN_PX, widthOf(key) + step),
        },
      });
    } else if (event.key === "Enter" || event.key === "Delete") {
      event.preventDefault();
      resetWidth(key);
    }
  };
  const resetWidth = (key: string) => {
    const next = { ...prefs.columnWidths };
    delete next[key];
    setPrefs({ columnWidths: next });
  };

  const chips: StatChip[] | null = stats?.length
    ? stats.map((stat) => {
        const current = stat.column ? filters[stat.column] : null;
        return {
          key: stat.key,
          label: stat.label,
          tone: stat.tone ?? "neutral",
          count:
            stat.column && stat.value !== undefined
              ? countWhere(rows, stat.column, stat.value)
              : rows.length,
          pressed:
            stat.column && stat.value !== undefined
              ? Array.isArray(current) && current.length === 1 && current[0] === stat.value
              : !stats.some((other) => other.column && isActiveFilter(filters[other.column])),
        };
      })
    : null;
  const toggleChip = (key: string) => {
    const stat = stats?.find((item) => item.key === key);
    if (!stat) return;
    const statColumns = stats!.flatMap((item) => (item.column ? [item.column] : []));
    const cleared = Object.fromEntries(statColumns.map((column) => [column, null]));
    if (!stat.column || stat.value === undefined)
      return setPrefs({ filters: { ...filters, ...cleared } });
    const pressed = chips?.find((item) => item.key === key)?.pressed;
    setPrefs({ filters: { ...filters, ...cleared, [stat.column]: pressed ? null : [stat.value] } });
  };

  const exportable = visible.filter((column) => !column.noExport);
  const exportColumns = prefs.columnOrder.flatMap((key) => {
    const column = byKey.get(key);
    return column && !column.noExport ? [column] : [];
  });
  const sortOf = (key: string) =>
    prefs.sort?.key === key ? (prefs.sort.dir === "asc" ? "ascending" : "descending") : undefined;
  const cellAlign = (column: ColumnDef) =>
    column.align === "right"
      ? "justify-end text-right"
      : column.align === "center"
        ? "justify-center"
        : "";

  return (
    <div className="grid gap-3 scheme-light">
      {chips && !compact ? <StatChips chips={chips} onToggle={toggleChip} /> : null}
      {!compact ? (
        <DataTableToolbar
          search={search}
          onSearch={setSearch}
          placeholder={searchPlaceholder}
          label={`Search ${caption}`}
          activeFilters={activeFilterCount(filters)}
          onClear={() => {
            setSearch("");
            setPrefs({ filters: {} });
          }}
        >
          {toolbar}
          <DataTableExportMenu
            columns={exportColumns}
            visibleKeys={exportable.map((column) => column.key)}
            rows={processed}
            fileName={caption}
          />
          <DataTableColumnsMenu
            columns={allColumns}
            order={prefs.columnOrder}
            hidden={prefs.hiddenColumns}
            onChange={({ order, hidden }) =>
              setPrefs({ columnOrder: order, hiddenColumns: hidden })
            }
            onReset={resetPrefs}
          />
        </DataTableToolbar>
      ) : null}

      {selectable ? (
        <BulkActionBar count={selectedRows.length} onClear={() => setSelected(new Set())}>
          <Button
            variant="outline"
            size="dense"
            onClick={() =>
              downloadCsv(csvFileName(`${caption}-selected`), rowsToCsv(exportable, selectedRows))
            }
          >
            <Download aria-hidden className="size-3.5" /> Export selected
          </Button>
        </BulkActionBar>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-white">
        <div className="relative overflow-x-auto">
          <table
            role="table"
            aria-label={caption}
            aria-rowcount={processed.length + 1}
            className="grid w-full min-w-min text-[13px] text-[var(--color-ink)]"
            style={{ gridTemplateColumns: template }}
          >
            <thead role="rowgroup" className="contents">
              <tr ref={headerRow} role="row" className="contents">
                {selectable ? (
                  <th role="columnheader" scope="col" className={headerCell}>
                    <label className="flex size-full cursor-pointer items-center justify-center">
                      <CheckboxControl
                        aria-label="Select all rows on this page"
                        checked={headerState === true}
                        indeterminate={headerState === "indeterminate"}
                        disabled={!pageKeys.length}
                        onChange={() => setSelected(togglePageSelection(selected, pageKeys))}
                      />
                    </label>
                  </th>
                ) : null}
                {visible.map((column) => (
                  <th
                    key={column.key}
                    role="columnheader"
                    scope="col"
                    data-col={column.key}
                    aria-sort={column.sortable ? (sortOf(column.key) ?? "none") : undefined}
                    className={cn(headerCell, "group/col relative border-r px-1.5")}
                  >
                    <ColumnHeaderMenu
                      column={column}
                      sort={prefs.sort}
                      onSort={(sort) => setPrefs({ sort })}
                      filter={filters[column.key] ?? null}
                      onFilter={(value) => setFilter(column.key, value)}
                      options={column.filter === "select" ? filterOptions(column, rows) : []}
                    />
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize column ${column.label}`}
                      aria-valuemin={MIN_COLUMN_PX}
                      aria-valuenow={prefs.columnWidths[column.key]}
                      tabIndex={0}
                      title="Drag to resize · double-click to reset"
                      onPointerDown={(event) => startResize(event, column.key)}
                      onDoubleClick={() => resetWidth(column.key)}
                      onKeyDown={(event) => keyResize(event, column.key)}
                      className="absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize touch-none transition-colors select-none group-hover/col:bg-[var(--color-line)] hover:bg-[var(--color-accent)]/50 focus-visible:bg-[var(--color-accent)] focus-visible:outline-none"
                    />
                  </th>
                ))}
                {hasActions ? (
                  <th
                    role="columnheader"
                    scope="col"
                    className={cn(headerCell, stickyRight, "justify-end px-2.5 uppercase")}
                  >
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody role="rowgroup" className="contents">
              {pageRows.map((row, index) => {
                const isSelected = selected.has(row.id);
                return (
                  <tr
                    key={row.id}
                    role="row"
                    aria-rowindex={page * prefs.pageSize + index + 2}
                    aria-selected={selectable ? isSelected : undefined}
                    className="group contents"
                  >
                    {selectable ? (
                      <td role="cell" className={cn(bodyCell, isSelected && selectedBg, "p-0")}>
                        <label className="flex size-full cursor-pointer items-center justify-center">
                          <CheckboxControl
                            aria-label={`Select row ${index + 1 + page * prefs.pageSize}`}
                            checked={isSelected}
                            onChange={() => setSelected(toggleKey(selected, row.id))}
                          />
                        </label>
                      </td>
                    ) : null}
                    {visible.map((column) => (
                      <td
                        key={column.key}
                        role="cell"
                        className={cn(
                          bodyCell,
                          "border-r border-r-[var(--color-line)]/50",
                          cellAlign(column),
                          isSelected && selectedBg,
                        )}
                      >
                        {renderCell(column, row)}
                      </td>
                    ))}
                    {hasActions ? (
                      <td
                        role="cell"
                        className={cn(
                          bodyCell,
                          stickyRight,
                          "justify-end px-1.5",
                          isSelected && selectedBg,
                        )}
                      >
                        {row.actions}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
              {!pageRows.length ? (
                <tr role="row" className="contents">
                  <td role="cell" className="col-span-full px-4 py-10 text-center">
                    <Inbox
                      aria-hidden
                      className="mx-auto mb-2 size-6 text-[var(--color-ink-muted)]"
                    />
                    <p className="font-medium">
                      {rows.length ? "No rows match the search or filters" : emptyTitle}
                    </p>
                    {rows.length || emptyDescription ? (
                      <p className="mt-1 text-[12.5px] text-[var(--color-ink-muted)]">
                        {rows.length
                          ? "Try a different search or clear the filters."
                          : emptyDescription}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {!compact && processed.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] bg-[var(--color-surface-muted)] px-3 py-1.5 text-[12px] text-[var(--color-ink-muted)]">
            <label className="flex items-center gap-2">
              Rows per page
              <select
                value={prefs.pageSize}
                onChange={(event) => setPrefs({ pageSize: Number(event.target.value) })}
                className="h-7 rounded-md border border-[var(--color-field-border)] bg-white px-1.5 text-[12px] text-[var(--color-ink)] pointer-coarse:h-(--touch-min)"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <nav aria-label={`Pages of ${caption}`} className="flex items-center gap-2">
              <span aria-live="polite">
                {page * prefs.pageSize + 1}–
                {Math.min(processed.length, (page + 1) * prefs.pageSize)} of {processed.length}
              </span>
              <Button
                variant="quiet"
                size="denseIcon"
                aria-label="Previous page"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft aria-hidden className="size-3.5" />
              </Button>
              <span>
                {page + 1} / {pageCount}
              </span>
              <Button
                variant="quiet"
                size="denseIcon"
                aria-label="Next page"
                disabled={page >= pageCount - 1}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight aria-hidden className="size-3.5" />
              </Button>
            </nav>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const headerCell =
  "flex min-h-8 min-w-0 items-center border-b border-[var(--color-line)] border-r-[var(--color-line)] bg-[var(--color-surface-muted)] text-[11px] font-medium tracking-wide text-[var(--color-ink-muted)]";
const bodyCell =
  "flex min-h-[29px] min-w-0 items-center overflow-hidden border-b border-[var(--color-line)]/70 bg-white px-2.5 py-1 leading-5 group-hover:bg-[var(--color-surface-hover)]";
const selectedBg = "bg-[var(--color-accent-soft)] group-hover:bg-[var(--color-accent-soft)]";
const stickyRight =
  "sticky right-0 z-[1] border-l border-l-[var(--color-line)] shadow-[-6px_0_8px_-8px_var(--color-ink-muted)]";
