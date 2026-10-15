"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { HEX_COLOR } from "@/lib/validation/hex-color";
import type { MapSpec } from "../../types";

/**
 * Applies an edit to the spec. `key` names the field being edited: edits with
 * the same key in a row are one undo step (typing a label).
 */
export type Edit = (update: (spec: MapSpec) => MapSpec, key?: string) => void;

export interface PanelProps {
  spec: MapSpec;
  edit: Edit;
  /** Changes after an undo, so uncontrolled inputs (rich text) start again from the spec. */
  generation: number;
}

const LABEL = "text-[12.5px] font-medium text-[var(--color-ink-soft)]";

/** A radio group: legend and one option per choice. */
export function Choice<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="grid gap-1">
      <legend className={cn(LABEL, "mb-1")}>{legend}</legend>
      <div className="flex flex-wrap gap-x-4">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-(--touch-min) cursor-pointer items-center gap-2 text-[13.5px]"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="size-4 accent-[var(--color-accent)]"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A colour well with its label (always on — see ColorField for an optional colour). */
export function ColorInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="grid gap-1.5">
      <span className={LABEL}>{label}</span>
      <input
        id={id}
        type="color"
        value={HEX_COLOR.test(value) ? value : "#000000"}
        onChange={(event) => onChange(event.target.value.toLowerCase())}
        className="h-(--touch-min) w-16 cursor-pointer rounded-lg border border-[var(--color-line)] bg-white p-1"
      />
    </label>
  );
}

/**
 * A whole number in a range: a slider and a number field kept in step. The
 * number field may hold a half-typed value; only valid numbers reach `onChange`.
 */
export function RangeNumber({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (raw: string) => {
    const number = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(number) && number >= min && number <= max) {
      onChange(number);
    }
  };
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
        {unit ? ` (${unit})` : ""}
      </label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-h-(--touch-min) flex-1 accent-[var(--color-accent)]"
        />
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={draft ?? String(value)}
          onChange={(event) => {
            setDraft(event.target.value);
            commit(event.target.value);
          }}
          onBlur={() => setDraft(null)}
          className="min-h-(--touch-min) w-20 rounded-lg border border-[var(--color-field-border)] px-2 text-[14px]"
        />
      </div>
    </div>
  );
}

/** A labelled group of controls in a panel. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 border-t border-[var(--color-line)] pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-[13px] font-semibold text-[var(--color-ink)]">{title}</h3>
      {children}
    </section>
  );
}

/** A short note under a control (limits, hints). */
export function Hint({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "warn";
}) {
  return (
    <p
      className={cn(
        "text-[12px]",
        tone === "warn" ? "text-[var(--color-warning)]" : "text-[var(--color-ink-muted)]",
      )}
    >
      {children}
    </p>
  );
}
