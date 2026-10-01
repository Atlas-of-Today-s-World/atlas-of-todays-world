import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Pill badge (status, tag, count) — one look for every label in the admin.
 * Tones map to the colour tokens in globals.css, never to raw palette classes.
 */
export const badgeVariants = cva(
  "inline-flex max-w-full items-center gap-1 truncate rounded-full font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-[var(--color-line)] text-[var(--color-ink-soft)]",
        accent: "bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]",
        success: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
        warning: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
        danger: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
        outline:
          "border border-dashed border-[var(--color-line)] bg-transparent text-[var(--color-ink-muted)]",
      },
      size: {
        sm: "px-2 py-px text-[11.5px] leading-[18px]",
        md: "px-2.5 py-0.5 text-[12px]",
      },
    },
    defaultVariants: { tone: "neutral", size: "sm" },
  },
);

export type Tone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({
  tone,
  size,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
