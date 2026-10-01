"use client";

import { badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { Tone } from "./types";

export interface StatChip {
  key: string;
  label: string;
  count: number;
  tone: Tone;
  pressed: boolean;
}

/**
 * Row of KPI chips above the table (label + count, tinted like a badge of the
 * same tone). A chip bound to a column value toggles that filter on click.
 */
export function StatChips({
  chips,
  onToggle,
}: {
  chips: readonly StatChip[];
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Summary">
      {chips.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={item.pressed}
          onClick={() => onToggle(item.key)}
          className={cn(
            badgeVariants({ tone: item.tone, size: "md" }),
            "min-h-8 gap-2 border px-3 font-normal transition focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none pointer-coarse:min-h-(--touch-min)",
            item.pressed
              ? "border-current"
              : item.tone === "outline"
                ? "hover:border-current/40"
                : "border-transparent hover:border-current/40",
          )}
        >
          <span>{item.label}</span>
          <span className="font-display text-[14px] font-bold tabular-nums">{item.count}</span>
        </button>
      ))}
    </div>
  );
}
