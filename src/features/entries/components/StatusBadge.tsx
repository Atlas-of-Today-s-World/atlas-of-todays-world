import { cva } from "class-variance-authority";
import { STATUS_LABEL, type EntryStatus } from "../schema";

const badge = cva("inline-flex rounded-full px-2.5 py-0.5 text-[11.5px] font-medium", {
  variants: {
    status: {
      draft: "bg-[var(--color-line)] text-[var(--color-ink-soft)]",
      pending: "bg-amber-100 text-amber-900",
      published: "bg-green-100 text-green-900",
      planned: "border border-dashed border-[var(--color-line)] text-[var(--color-ink-muted)]",
    },
  },
});

export function StatusBadge({ status }: { status: EntryStatus }) {
  return <span className={badge({ status })}>{STATUS_LABEL[status]}</span>;
}
