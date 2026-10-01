import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { displayText } from "./rows";
import type { CellValue, ColumnDef, DataTableRow } from "./types";

/** Admin is in English; dates in the unambiguous British order (1 Oct 2026). */
const DATE = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });
const DATETIME = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
const NUMBER = new Intl.NumberFormat("en-US");
/** Tags shown before the "+N" chip. */
const MAX_TAGS = 2;

const empty = <span className="text-[var(--color-ink-muted)]/70">—</span>;

function formatDate(value: CellValue, format: Intl.DateTimeFormat): string {
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : format.format(date);
}

function optionTone(column: ColumnDef, value: string) {
  return column.options?.find((option) => option.value === value)?.tone ?? "neutral";
}

function renderValue(column: ColumnDef, value: CellValue): ReactNode {
  if (value === null || value === undefined || value === "") return empty;
  if (Array.isArray(value) && value.length === 0) return empty;
  switch (column.kind) {
    case "number":
      return (
        <span className="tabular-nums">
          {typeof value === "number" ? NUMBER.format(value) : String(value)}
        </span>
      );
    case "date":
      return <span className="tabular-nums">{formatDate(value, DATE)}</span>;
    case "datetime":
      return <span className="tabular-nums">{formatDate(value, DATETIME)}</span>;
    case "badge": {
      const raw = String(value);
      return <Badge tone={optionTone(column, raw)}>{displayText(column, raw)}</Badge>;
    }
    case "tags": {
      const tags = (Array.isArray(value) ? value : [String(value)]) as readonly string[];
      const rest = tags.slice(MAX_TAGS);
      return (
        <span className="flex min-w-0 items-center gap-1">
          {tags.slice(0, MAX_TAGS).map((tag) => (
            <Badge key={tag} tone={optionTone(column, tag)} className="min-w-0">
              {displayText(column, tag)}
            </Badge>
          ))}
          {rest.length ? (
            <Badge
              tone="outline"
              title={rest.map((tag) => displayText(column, tag)).join(", ")}
              className="shrink-0"
            >
              +{rest.length}
            </Badge>
          ) : null}
        </span>
      );
    }
    case "code":
      return <code className="truncate font-mono text-[12px]">{String(value)}</code>;
    case "boolean":
      return value ? "Yes" : "No";
    case "color":
      return (
        <span
          aria-hidden
          className="block size-3.5 rounded-full border border-black/10"
          style={{ background: String(value) }}
        />
      );
    default:
      return <span className="truncate">{displayText(column, value)}</span>;
  }
}

/** Content of one cell: the row's pre-rendered node, else the built-in render. */
export function renderCell(column: ColumnDef, row: DataTableRow): ReactNode {
  const own = row.cells?.[column.key];
  if (own !== undefined) return own;
  const content = renderValue(column, row.values[column.key]);
  if (column.link && row.href) {
    return (
      <Link
        href={row.href}
        className="truncate font-medium text-[var(--color-ink)] underline-offset-2 hover:text-[var(--color-accent)] hover:underline"
      >
        {content}
      </Link>
    );
  }
  return content;
}
