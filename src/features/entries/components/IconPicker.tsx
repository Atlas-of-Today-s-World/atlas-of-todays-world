"use client";

import { useState } from "react";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { TILE_ICON_LABEL, TILE_ICONS } from "../constants";
import { TileIcon } from "./TileIcon";

/**
 * Picks one of the tile icons (well over a hundred): a search box over the
 * names and a scrollable grid; the chosen one is highlighted and named.
 */
export function IconPicker({
  id,
  value,
  label,
  onChange,
}: {
  id: string;
  value: string;
  label: string;
  onChange: (icon: string) => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = TILE_ICONS.filter(
    (icon) =>
      !needle || icon.includes(needle) || TILE_ICON_LABEL[icon].toLowerCase().includes(needle),
  );

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">Icon</span>
        <span className="flex items-center gap-1.5 text-[12.5px] text-[var(--color-ink-muted)]">
          <TileIcon name={value} className="size-4" />
          {TILE_ICON_LABEL[value as keyof typeof TILE_ICON_LABEL] ?? value}
        </span>
        <Input
          id={id}
          type="search"
          value={query}
          placeholder={`Search ${TILE_ICONS.length} icons…`}
          aria-label={`Search icons for ${label}`}
          onChange={(event) => setQuery(event.target.value)}
          className="ml-auto max-w-56"
        />
      </div>
      <div
        role="radiogroup"
        aria-label={`Icon of ${label}`}
        className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-[var(--color-line)] p-2"
      >
        {shown.map((icon) => (
          <button
            key={icon}
            type="button"
            role="radio"
            aria-checked={value === icon}
            aria-label={TILE_ICON_LABEL[icon]}
            title={TILE_ICON_LABEL[icon]}
            onClick={() => onChange(icon)}
            className={cn(
              "grid size-(--touch-min) place-items-center rounded-lg border transition focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none",
              value === icon
                ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                : "border-transparent text-[var(--color-ink-soft)] hover:border-[var(--color-line)]",
            )}
          >
            <TileIcon name={icon} className="size-4.5" />
          </button>
        ))}
        {!shown.length ? (
          <p className="p-2 text-[12.5px] text-[var(--color-ink-muted)]">No icon matches.</p>
        ) : null}
      </div>
    </div>
  );
}
