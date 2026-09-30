import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Jediné tlačítko Atlasu (ARCHITEKTURA 15.1, D5). Pro odkazy vzhledu tlačítka
 * použij `buttonVariants()` na `<Link className=…>`.
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
        ghost: "text-[var(--color-ink-soft)] underline-offset-2 hover:underline",
      },
      size: {
        md: "min-h-(--touch-min) px-6 text-[14px]",
        sm: "min-h-(--touch-min) px-4 text-[13px]",
        /** Štítek (země, kategorie) — menší, ale vždy s 44px dotykovou plochou řádku. */
        chip: "px-3 py-1 text-[12px] font-normal",
        icon: "size-(--touch-min)",
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
