"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
}

const tabId = (base: string, id: string) => `${base}-tab-${id}`;
const panelId = (base: string, id: string) => `${base}-panel-${id}`;

/**
 * Tabs (WAI-ARIA tabs pattern): one tab stop, arrows / Home / End move
 * between tabs and select them. Controlled: the caller keeps `value` and
 * renders the panels with `TabPanel` under the same `idBase`.
 */
export function Tabs<T extends string>({
  label,
  idBase,
  items,
  value,
  onChange,
  className,
}: {
  /** Accessible name of the tab list. */
  label: string;
  idBase: string;
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((item) => item.id === value);
    const last = items.length - 1;
    const next =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    const item = next === null ? undefined : items[next];
    if (!item) return;
    event.preventDefault();
    onChange(item.id);
    document.getElementById(tabId(idBase, item.id))?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={move}
      className={cn("flex gap-1 border-b border-[var(--color-line)]", className)}
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            id={tabId(idBase, item.id)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(idBase, item.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              "-mb-px min-h-(--touch-min) border-b-2 px-3 text-[13px] font-medium transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-accent)]",
              selected
                ? "border-[var(--color-accent)] text-[var(--color-accent-strong)]"
                : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** The panel of tab `id`; only the selected one is rendered. */
export function TabPanel({
  idBase,
  id,
  selected,
  className,
  children,
}: {
  idBase: string;
  id: string;
  selected: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (!selected) return null;
  return (
    <div
      id={panelId(idBase, id)}
      role="tabpanel"
      aria-labelledby={tabId(idBase, id)}
      tabIndex={0}
      className={cn(
        "focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
