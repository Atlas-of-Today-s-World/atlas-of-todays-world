import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A short line of body text under a heading — one class set instead of a
 * hand-written `text-[14px] text-[var(--color-ink-soft)]` on every page:
 * - size — 14 px on pages, 13 px in panels and rails, 12 px in compact rows;
 * - tone — soft (body), muted (secondary), inverse (on the dark map glass);
 * - leading — relaxed for a lead paragraph of several lines.
 * The spacing above it (`mt-*`) belongs to the place and comes as `className`.
 */
const noteVariants = cva("", {
  variants: {
    size: { xs: "text-[12px]", sm: "text-[13px]", md: "text-[14px]" },
    tone: {
      soft: "text-[var(--color-ink-soft)]",
      muted: "text-[var(--color-ink-muted)]",
      inverse: "text-white/60",
    },
    leading: { normal: "", relaxed: "leading-relaxed" },
  },
  defaultVariants: { size: "md", tone: "soft", leading: "normal" },
});

type NoteProps = VariantProps<typeof noteVariants> & { className?: string; children: ReactNode };

/** "Nothing here yet" / "No results": the line that stands in for an empty list. */
export function EmptyNote({ size, tone, className, children }: NoteProps) {
  return <p className={cn(noteVariants({ size, tone }), className)}>{children}</p>;
}

/** The lead paragraph under a page or article title. */
export function Lead({
  className,
  children,
}: Omit<NoteProps, keyof VariantProps<typeof noteVariants>>) {
  return <p className={cn(noteVariants({ leading: "relaxed" }), className)}>{children}</p>;
}
