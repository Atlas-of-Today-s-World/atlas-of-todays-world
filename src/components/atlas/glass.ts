import { cva } from "class-variance-authority";

/**
 * Glass surfaces over the map (the `.glass` look in globals.css):
 * - panel — a block in the controls column (search, "Latest subtopics", the
 *   global issues menu): full width on phones, 22 rem from `sm` up;
 * - pill — a 35 px floating button ("Newsletter", "Support the Atlas") whose
 *   invisible `before:` margin keeps the 44 px touch target.
 * Tone `support` swaps the glass for the solid red of "Support the Atlas".
 */
export const glassVariants = cva("pointer-events-auto", {
  variants: {
    kind: {
      panel:
        "w-full rounded-[var(--radius-panel)] p-2 shadow-2xl shadow-black/40 sm:w-[min(92vw,22rem)] sm:p-3",
      pill: "relative flex h-[35px] min-w-[35px] items-center gap-2 rounded-full px-[4.5px] text-[11px] font-medium text-white transition before:absolute before:-inset-[4.5px] before:rounded-full before:content-[''] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 sm:pr-[13px]",
    },
    tone: {
      glass: "glass",
      support:
        "border border-white/20 bg-support shadow-lg shadow-black/30 hover:bg-support-strong",
    },
  },
  compoundVariants: [{ kind: "pill", tone: "glass", class: "glass-hover" }],
  defaultVariants: { tone: "glass" },
});
