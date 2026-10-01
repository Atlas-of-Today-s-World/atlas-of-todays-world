"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Bare checkbox for dense places (table selection, permission matrix) where
 * the visible label is the row or column header: `aria-label` is required.
 * `indeterminate` is a DOM property only, so it is set through a ref.
 * Forms with a visible label use `Checkbox` from `ui/field`.
 */
export function CheckboxControl({
  indeterminate = false,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "aria-label"> & {
  "aria-label": string;
  indeterminate?: boolean;
}) {
  return (
    <input
      type="checkbox"
      ref={(element) => {
        if (element) element.indeterminate = indeterminate;
      }}
      aria-checked={indeterminate ? "mixed" : undefined}
      className={cn(
        "size-3.5 cursor-pointer accent-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
