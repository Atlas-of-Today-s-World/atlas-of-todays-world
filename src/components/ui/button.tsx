import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * The single Atlas button (ARCHITEKTURA 15.1, D5). For links styled as buttons
 * use `buttonVariants()` on `<Link className=…>`.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-strong)]",
        outline:
          "border border-[var(--color-line)] bg-white text-[var(--color-ink)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]",
        danger: "bg-red-700 text-white hover:bg-red-800",
        /** Atlas Patrons call to action (nav highlight, membership page). */
        patron: "bg-[var(--color-patron)] text-white hover:bg-[var(--color-patron-strong)]",
        /** Dark button on the blue donation card ("Donate & Join"). */
        ink: "bg-[var(--color-ink)] text-white hover:bg-black",
        ghost: "text-[var(--color-ink-soft)] underline-offset-2 hover:underline",
        /** Icon and tool actions in tables — no border, tinted on hover. */
        quiet:
          "text-[var(--color-ink-muted)] hover:bg-[var(--color-line)]/70 hover:text-[var(--color-ink)]",
        quietDanger:
          "text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]",
      },
      size: {
        md: "min-h-(--touch-min) px-6 text-[14px]",
        sm: "min-h-(--touch-min) px-4 text-[13px]",
        /** Chip (country, category) — 32 px with a mouse, 44 px on a touch screen. */
        chip: "min-h-8 px-3 py-1 text-[12px] font-normal pointer-coarse:min-h-(--touch-min)",
        icon: "size-(--touch-min)",
        /**
         * Dense controls above and inside tables (32 px / 24 px with a mouse). On a touch
         * screen (pointer: coarse) it grows to 44 px, as ARCHITEKTURA 5.1 requires.
         */
        dense: "h-8 px-3 text-[12.5px] pointer-coarse:min-h-(--touch-min)",
        denseIcon: "size-8 pointer-coarse:size-(--touch-min)",
        rowIcon: "size-6 rounded-md pointer-coarse:size-(--touch-min)",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  block,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & ButtonVariants) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
}
