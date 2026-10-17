"use client";

import { CalendarClock, Check, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { RegionProgress } from "@/features/geography/content-status";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { REGION_PROGRESS_LABEL } from "../constants";

const OPTIONS = [
  { value: "planned", label: "Planned", Icon: CalendarClock },
  { value: "completed", label: "Completed", Icon: Check },
] as const satisfies readonly { value: RegionProgress; label: string; Icon: LucideIcon }[];

/**
 * A region's content in the list of regions: planned for the future or
 * completed, switched in one click (the other button undoes it, like moving a
 * row). The globe and the portrait follow after the save.
 */
export function RegionProgressSwitch({
  region,
  progress,
  actions,
  disabled,
}: {
  /** The region's name, for the buttons' accessible names. */
  region: string;
  progress: RegionProgress;
  /** Server Actions bound to the region, one per state. */
  actions: Record<RegionProgress, () => Promise<ActionState>>;
  /** Without the right to edit regions: the state only. */
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span
        role="group"
        aria-label={`Content of ${region}`}
        aria-busy={pending || undefined}
        className="inline-flex overflow-hidden rounded-md border border-[var(--color-line)] bg-white text-[12px]"
      >
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = progress === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              title={REGION_PROGRESS_LABEL[value]}
              disabled={disabled || pending}
              onClick={() => {
                if (active) return;
                start(async () => {
                  const state = await actions[value]();
                  setError(state.ok ? "" : (state.error ?? "Something went wrong."));
                  if (state.ok) router.refresh();
                });
              }}
              className={cn(
                "inline-flex h-6 items-center gap-1 px-2 font-medium transition-colors not-first:border-l not-first:border-[var(--color-line)] pointer-coarse:min-h-(--touch-min)",
                active
                  ? value === "completed"
                    ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                    : "bg-[var(--color-warning-soft)] text-[var(--color-warning)]"
                  : "text-[var(--color-ink-muted)] enabled:hover:bg-[var(--color-surface-hover)] enabled:hover:text-[var(--color-ink)]",
                "disabled:cursor-not-allowed",
              )}
            >
              <Icon size={12} strokeWidth={2.5} aria-hidden />
              {label}
            </button>
          );
        })}
      </span>
      {error ? (
        <span role="alert" className="text-[11.5px] text-[var(--color-danger)]">
          {error}
        </span>
      ) : null}
    </span>
  );
}
