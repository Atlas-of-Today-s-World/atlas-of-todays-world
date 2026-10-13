"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Select } from "@/components/ui/field";
import { swap } from "@/lib/array";
import { IconAction } from "./IconAction";

export interface PickerOption {
  value: string;
  label: string;
}

/**
 * A short ordered choice from a list (a country card's indicators): picked
 * items are numbered, moved with buttons (keyboard-friendly) and removed; the
 * select below adds the next one until `max` is reached. The form receives the
 * values as a repeated field in the chosen order.
 */
export function OrderedPicker({
  id,
  name,
  options,
  defaultSelected,
  max,
  itemLabel = "item",
}: {
  /** Id of the "add" select — the FormField label points at it. */
  id: string;
  name: string;
  options: PickerOption[];
  defaultSelected: string[];
  max: number;
  /** One item in the buttons' accessible names ("Move indicator 2 up"). */
  itemLabel?: string;
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const labelOf = useMemo(() => new Map(options.map((o) => [o.value, o.label])), [options]);
  const left = options.filter((option) => !selected.includes(option.value));
  const full = selected.length >= max;

  return (
    <div className="grid gap-2">
      {selected.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
      {selected.length ? (
        <ol className="grid gap-1" aria-label={`Chosen, in order (${selected.length} of ${max})`}>
          {selected.map((value, index) => {
            const n = index + 1;
            return (
              <li
                key={value}
                className="flex items-center gap-2 rounded-lg bg-[var(--color-line)]/25 py-0.5 pr-1 pl-3 text-[13.5px]"
              >
                <span className="w-5 text-right text-[12px] text-[var(--color-ink-muted)] tabular-nums">
                  {n}.
                </span>
                <span className="flex-1">{labelOf.get(value) ?? value}</span>
                <IconAction
                  label={`Move ${itemLabel} ${n} up`}
                  disabled={index === 0}
                  onClick={() => setSelected((current) => swap(current, index, index - 1))}
                  icon={<ArrowUp size={16} aria-hidden />}
                />
                <IconAction
                  label={`Move ${itemLabel} ${n} down`}
                  disabled={index === selected.length - 1}
                  onClick={() => setSelected((current) => swap(current, index, index + 1))}
                  icon={<ArrowDown size={16} aria-hidden />}
                />
                <IconAction
                  label={`Remove ${itemLabel} ${n}`}
                  onClick={() => setSelected((current) => current.filter((v) => v !== value))}
                  icon={<X size={16} aria-hidden />}
                />
              </li>
            );
          })}
        </ol>
      ) : null}
      <Select
        id={id}
        value=""
        disabled={full || !left.length}
        onChange={(event) => {
          const value = event.target.value;
          if (value) setSelected((current) => [...current, value].slice(0, max));
        }}
      >
        <option value="">
          {full ? `${max} chosen — remove one to add another` : `Add ${itemLabel}…`}
        </option>
        {left.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
