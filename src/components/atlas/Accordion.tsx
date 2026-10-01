import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Plus } from "lucide-react";

const item = cva("group rounded-xl border border-[var(--color-line)] bg-white", {
  variants: {
    size: {
      /** Inside a portrait panel. */
      compact: "px-4 py-3",
      /** Full-width page FAQ (Atlas Patrons). */
      comfortable: "px-5 py-3 sm:px-6",
    },
  },
  defaultVariants: { size: "compact" },
});

const question = cva(
  "flex min-h-(--touch-min) cursor-pointer list-none items-center justify-between gap-3 rounded-md font-medium text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] [&::-webkit-details-marker]:hidden",
  {
    variants: { size: { compact: "text-[13px]", comfortable: "py-1 text-[16px]" } },
    defaultVariants: { size: "compact" },
  },
);

const answer = cva("leading-relaxed text-[var(--color-ink-soft)]", {
  variants: { size: { compact: "mt-2.5 text-[12.5px]", comfortable: "mt-2 pb-3 text-[15px]" } },
  defaultVariants: { size: "compact" },
});

export interface AccordionItem {
  question: string;
  answer: ReactNode;
}

/**
 * The single expandable question list (FAQ) of the Atlas: native
 * <details>/<summary>, so it works without JavaScript and with the keyboard.
 */
export function Accordion({
  items,
  size,
}: { items: readonly AccordionItem[] } & VariantProps<typeof item>) {
  return (
    <div className="space-y-2">
      {items.map((entry) => (
        <details key={entry.question} className={item({ size })}>
          <summary className={question({ size })}>
            {entry.question}
            <Plus
              aria-hidden
              size={size === "comfortable" ? 22 : 16}
              strokeWidth={1.6}
              className="shrink-0 text-[var(--color-ink-muted)] transition group-open:rotate-45"
            />
          </summary>
          <div className={answer({ size })}>{entry.answer}</div>
        </details>
      ))}
    </div>
  );
}
