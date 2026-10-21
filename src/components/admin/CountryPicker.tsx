"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { addGroup, removeGroup, type CountryGroupOption } from "./country-groups";

export interface CountryOption {
  iso3: string;
  name: string;
}

/** Groups whose countries can be added or removed at once ("Regions", "Custom regions"). */
export interface CountryGroups {
  label: string;
  options: CountryGroupOption[];
}

/**
 * "Add / remove all countries of …": one select over every group (regions,
 * custom regions) and two buttons. Says what it did, since the chips above
 * may change out of view.
 */
function GroupActions({
  id,
  groups,
  selected,
  known,
  onChange,
}: {
  id: string;
  groups: CountryGroups[];
  selected: string[];
  known: ReadonlySet<string>;
  onChange: (next: string[]) => void;
}) {
  const [choice, setChoice] = useState("");
  const [note, setNote] = useState("");
  const [groupIndex, key] = choice.split(":");
  const group = groups[Number(groupIndex)]?.options.find((option) => option.key === key);

  const apply = (mode: "add" | "remove") => {
    if (!group) return;
    const result =
      mode === "add"
        ? addGroup(selected, group.countries, known)
        : removeGroup(selected, group.countries);
    onChange(result.selected);
    setNote(
      `${mode === "add" ? "Added" : "Removed"} ${result.changed} ${result.changed === 1 ? "country" : "countries"} of ${group.name}.`,
    );
  };

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`${id}-group`} className="sr-only">
          Whole region or custom region
        </label>
        <Select
          id={`${id}-group`}
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
          className="w-auto min-w-56 flex-1"
        >
          <option value="">Whole region or custom region…</option>
          {groups.map((set, index) =>
            set.options.length ? (
              <optgroup key={set.label} label={set.label}>
                {set.options.map((option) => (
                  <option key={option.key} value={`${index}:${option.key}`}>
                    {option.name} ({option.countries.length})
                  </option>
                ))}
              </optgroup>
            ) : null,
          )}
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!group}
          onClick={() => apply("add")}
        >
          Add its countries
        </Button>
        <Button
          type="button"
          variant="quiet"
          size="sm"
          disabled={!group}
          onClick={() => apply("remove")}
        >
          Remove its countries
        </Button>
      </div>
      <p aria-live="polite" className="text-[12px] text-[var(--color-ink-muted)]">
        {note}
      </p>
    </div>
  );
}

/**
 * One button for the group the form already names (an article's region):
 * "Add all N countries of …". Says what it did, like GroupActions.
 */
function GroupShortcut({
  group,
  selected,
  known,
  onChange,
}: {
  group: CountryGroupOption;
  selected: string[];
  known: ReadonlySet<string>;
  onChange: (next: string[]) => void;
}) {
  const [note, setNote] = useState("");
  const missing = group.countries.filter((iso3) => known.has(iso3) && !selected.includes(iso3));
  return (
    <div className="grid gap-1.5">
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!missing.length}
          onClick={() => {
            const result = addGroup(selected, group.countries, known);
            onChange(result.selected);
            setNote(
              `Added ${result.changed} ${result.changed === 1 ? "country" : "countries"} of ${group.name}.`,
            );
          }}
        >
          {missing.length
            ? `Add all ${missing.length} ${missing.length === 1 ? "country" : "countries"} of ${group.name}`
            : `All countries of ${group.name} added`}
        </Button>
      </div>
      <p aria-live="polite" className="text-[12px] text-[var(--color-ink-muted)]">
        {note}
      </p>
    </div>
  );
}

/**
 * Multi-country picker (article, global issue, approver assignment, map
 * visual). Searches by name and ISO code; selected countries go into the form
 * as a repeated field (`name`) and/or to `onChange`.
 * With `groups`, whole regions or custom regions can be added or removed at once;
 * `shortcut` puts one of them (the article's region) on a button of its own.
 */
export function CountryPicker({
  id,
  name,
  options,
  defaultSelected,
  groups,
  shortcut,
  onChange,
}: {
  id: string;
  name?: string;
  options: CountryOption[];
  defaultSelected: string[];
  groups?: CountryGroups[];
  shortcut?: CountryGroupOption | null;
  onChange?: (selected: string[]) => void;
}) {
  const [selected, setSelectedState] = useState<string[]>(defaultSelected);
  const setSelected = (update: string[] | ((current: string[]) => string[])) => {
    const next = typeof update === "function" ? update(selected) : update;
    setSelectedState(next);
    onChange?.(next);
  };
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
      {name
        ? selected.map((iso3) => <input key={iso3} type="hidden" name={name} value={iso3} />)
        : null}
      {selected.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected countries">
          {selected.map((iso3) => (
            <li
              key={iso3}
              className="flex items-center gap-1 rounded-full bg-[var(--color-accent-soft)] py-0.5 pr-0.5 pl-3 text-[12.5px]"
            >
              {byIso.get(iso3) ?? iso3}
              <button
                type="button"
                aria-label={`Remove ${byIso.get(iso3) ?? iso3}`}
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
        placeholder="Add a country…"
        autoComplete="off"
        role="combobox"
        aria-expanded={matches.length > 0}
        aria-controls={`${id}-list`}
      />
      {matches.length ? (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="max-h-60 overflow-auto rounded-lg border border-[var(--color-field-border)]"
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
      {shortcut?.countries.length ? (
        <GroupShortcut
          key={shortcut.key}
          group={shortcut}
          selected={selected}
          known={new Set(byIso.keys())}
          onChange={setSelected}
        />
      ) : null}
      {groups?.some((set) => set.options.length) ? (
        <GroupActions
          id={id}
          groups={groups}
          selected={selected}
          known={new Set(byIso.keys())}
          onChange={setSelected}
        />
      ) : null}
    </div>
  );
}
