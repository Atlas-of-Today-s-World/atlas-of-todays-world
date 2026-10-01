"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Bar shown above the table while rows are selected: the count, the bulk
 * actions, and "Clear selection" always in the same place (TealHub).
 */
export function BulkActionBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children?: ReactNode;
}) {
  if (count <= 0) return null;
  return (
    <div
      role="region"
      aria-label="Selected rows"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] px-3 py-1.5"
    >
      <span className="text-[12.5px] font-medium" aria-live="polite">
        {count} selected
      </span>
      {children}
      <Button variant="quiet" size="dense" onClick={onClear} className="ml-auto">
        <X aria-hidden className="size-3" /> Clear selection
      </Button>
    </div>
  );
}
