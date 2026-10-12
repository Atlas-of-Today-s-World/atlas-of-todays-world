import { cva } from "class-variance-authority";

/**
 * Small uppercase label above a block — one class set for every element that
 * carries it (p, h2, h3, figcaption, span):
 * - pill — the dark section label (SectionLabel in ui.tsx);
 * - muted — on the light panels and pages ("In short", "Listen", a card's heading);
 * - glass — the heading of a glass panel over the map.
 */
export const kickerVariants = cva("uppercase", {
  variants: {
    tone: {
      pill: "inline-block rounded-full bg-[var(--color-space-raised)] px-3 py-1 text-[10.5px] font-medium tracking-[0.12em] text-white/85",
      muted: "text-[11px] font-medium tracking-[0.1em] text-[var(--color-ink-muted)]",
      glass: "px-1 text-[10.5px] font-medium tracking-[0.12em] text-white/75",
    },
  },
  defaultVariants: { tone: "muted" },
});
