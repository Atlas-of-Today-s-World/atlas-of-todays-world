"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/field";

export interface CountryOption {
  iso3: string;
  name: string;
}

/**
 * Výběr více zemí (článek, global issue, přiřazení schvalovatele). Hledá se
 * podle názvu i ISO kódu; vybrané země jdou do formuláře jako opakované pole.
 */
export function CountryPicker({
  id,
  name,
  options,
  defaultSelected,
}: {
  id: string;
  name: string;
  options: CountryOption[];
  defaultSelected: string[];
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [query, setQuery] = useState("");
  const byIso = useMemo(() => new Map(options.map((o) => [o.iso3, o.name])), [options]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return options
      .filter(
        (option) =>
          !selected.includes(option.iso3) &&
          (option.name.toLowerCase().includes(q) || option.iso3.toLowerCase() === q),
      )
      .slice(0, 8);
  }, [options, query, selected]);

  const add = (iso3: string) => {
    setSelected((current) => [...current, iso3]);
    setQuery("");
  };

  return (
    <div className="grid gap-2">
      {selected.map((iso3) => (
        <input key={iso3} type="hidden" name={name} value={iso3} />
      ))}
      {selected.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Vybrané země">
          {selected.map((iso3) => (
            <li
              key={iso3}
              className="flex items-center gap-1 rounded-full bg-[var(--color-accent-soft)] py-0.5 pr-0.5 pl-3 text-[12.5px]"
            >
              {byIso.get(iso3) ?? iso3}
              <button
                type="button"
                aria-label={`Odebrat ${byIso.get(iso3) ?? iso3}`}
                onClick={() => setSelected((current) => current.filter((c) => c !== iso3))}
                className="grid size-7 place-items-center rounded-full hover:bg-white/70"
              >
                <X size={13} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Input
        id={id}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && matches[0]) {
            event.preventDefault();
            add(matches[0].iso3);
          }
        }}
        placeholder="Přidat zemi…"
        autoComplete="off"
        role="combobox"
        aria-expanded={matches.length > 0}
        aria-controls={`${id}-list`}
      />
      {matches.length ? (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="max-h-60 overflow-auto rounded-lg border border-[var(--color-line)]"
        >
          {matches.map((option) => (
            <li key={option.iso3} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => add(option.iso3)}
                className="flex min-h-(--touch-min) w-full items-center justify-between px-3 text-left text-[13.5px] hover:bg-[var(--color-line)]/40"
              >
                {option.name}
                <span className="text-[11px] text-[var(--color-ink-muted)]">{option.iso3}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
