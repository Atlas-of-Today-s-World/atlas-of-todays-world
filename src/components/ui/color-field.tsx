"use client";

import { useState } from "react";
import { Checkbox } from "./field";

const FALLBACK = "#1f2a44";

/**
 * An optional colour: a checkbox turns it on, a colour well picks it. Posts
 * `name` (empty when off) or reports changes through `onChange` — for forms
 * with plain fields and for editors that keep state alike.
 */
export function ColorField({
  id,
  name,
  defaultValue,
  label,
  onChange,
}: {
  id: string;
  name?: string;
  defaultValue: string | null;
  /** Text next to the checkbox. */
  label: string;
  onChange?: (value: string | null) => void;
}) {
  const [value, setValueState] = useState<string | null>(defaultValue || null);
  const setValue = (next: string | null) => {
    setValueState(next);
    onChange?.(next);
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
      <input
        id={id}
        type="color"
        aria-label={label}
        value={value ?? FALLBACK}
        disabled={!value}
        onChange={(event) => setValue(event.target.value)}
        className="h-(--touch-min) w-16 cursor-pointer rounded-lg border border-[var(--color-line)] bg-white p-1 disabled:cursor-not-allowed disabled:opacity-40"
      />
      <Checkbox
        label={label}
        checked={Boolean(value)}
        onChange={(event) => setValue(event.target.checked ? FALLBACK : null)}
      />
    </div>
  );
}
