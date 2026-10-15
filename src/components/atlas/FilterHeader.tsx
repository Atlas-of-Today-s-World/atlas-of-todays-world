"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { setUrlParams } from "./url-filters";

const FIELD =
  "min-h-(--touch-min) w-full rounded-xl border border-[var(--color-field-border)] bg-white px-3 text-[14px] text-[var(--color-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none";

/** One place select of the panel; `kind` is its query parameter (`country`, `region`…). */
export interface FilterSelect<K extends string> {
  kind: K;
  label: string;
  /** The empty choice ("All countries"). */
  allLabel: string;
  /** [key, name] pairs, already sorted. */
  options: [key: string, name: string][];
}

/**
 * Top of an index page over the map (Topics, Global issues): the title and
 * intro on the left, on wide screens a compact white panel beside them with a
 * search field and one select per kind of place. One place filter at a time —
 * a new choice replaces the old one. Filter and query are written to the URL
 * (url-filters.ts); the page reads them back from there.
 */
export function FilterHeader<K extends string>({
  id,
  title,
  intro,
  query,
  filter,
  selects,
  texts,
}: {
  /** Prefix of the field ids (`topics` → `topics-search`, `topics-filter-country`). */
  id: string;
  /** The page's h1 and the paragraph under it. */
  title: string;
  intro: string;
  query: string;
  filter: { kind: K; key: string } | null;
  selects: FilterSelect<K>[];
  texts: {
    /** Hidden legend of the panel. */
    legend: string;
    search: string;
    searchPlaceholder: string;
    /** The button that drops the place filter ("Show all topics"). */
    clear: string;
    /** Tooltip of the selects. */
    hint: string;
  };
}) {
  const kinds = selects.map((select) => select.kind);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:items-end">
      <div>
        <h1 className="font-display text-[34px] font-bold tracking-tight sm:text-[44px]">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
          {intro}
        </p>
      </div>
      <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
        <fieldset className="grid gap-2 sm:grid-cols-3">
          <legend className="sr-only">{texts.legend}</legend>
          <span className="relative col-span-full flex items-center gap-1">
            <label htmlFor={`${id}-search`} className="sr-only">
              {texts.search}
            </label>
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-ink-muted)]"
            />
            <input
              id={`${id}-search`}
              type="search"
              value={query}
              onChange={(event) => setUrlParams({ q: event.target.value || null })}
              placeholder={texts.searchPlaceholder}
              maxLength={200}
              className={cn(FIELD, "pl-9")}
            />
            {filter ? (
              <button
                type="button"
                onClick={() => setUrlParams(Object.fromEntries(kinds.map((kind) => [kind, null])))}
                aria-label={texts.clear}
                title={texts.clear}
                className="inline-flex min-h-(--touch-min) shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-medium whitespace-nowrap text-[var(--color-link)] hover:bg-[var(--color-accent-soft)]"
              >
                <X aria-hidden className="size-4" />
                {texts.clear}
              </button>
            ) : null}
          </span>
          {selects.map(({ kind, label, allLabel, options }) => (
            <span key={kind} className="block">
              <label htmlFor={`${id}-filter-${kind}`} className="sr-only">
                {label}
              </label>
              <select
                id={`${id}-filter-${kind}`}
                value={filter?.kind === kind ? filter.key : ""}
                title={texts.hint}
                // One filter at a time: picking one clears the others.
                onChange={(event) =>
                  setUrlParams(
                    Object.fromEntries(
                      kinds.map((other) => [
                        other,
                        // Lowercase ISO3 for countries, like the "See all topics" links.
                        other === kind ? event.target.value.toLowerCase() || null : null,
                      ]),
                    ),
                  )
                }
                // The chosen filter stands out on a light gold ground.
                className={cn(
                  FIELD,
                  filter?.kind === kind &&
                    "border-[var(--color-gold)] bg-[var(--color-gold-light)]/45 font-medium",
                )}
              >
                <option value="">{allLabel}</option>
                {options.map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            </span>
          ))}
        </fieldset>
      </div>
    </div>
  );
}
