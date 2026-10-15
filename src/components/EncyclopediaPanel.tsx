"use client";

import { ArrowRight, Search } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { isSearchable, normalizeSearchQuery } from "@/lib/search-query";
import { useDebouncedSearch } from "@/lib/use-debounced-search";
import { glassVariants } from "@/components/atlas/glass";
import Link from "@/components/i18n/Link";
import { searchKindKey } from "@/lib/search-kind";
import { useLocalizedRouter } from "@/components/i18n/useLocalizedRouter";
import type { SearchHit } from "@/features/search/types";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { format } from "@/features/i18n/messages";
import { belongsToField } from "@/lib/keyboard";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";

/** One row of the result list: highlighted by the arrow keys, opened by Enter. */
const OPTION_CLASS =
  "block rounded-xl px-3 py-2 transition hover:bg-white/10 aria-selected:bg-white/10 aria-selected:ring-2 aria-selected:ring-white/70";

/**
 * "Global Encyclopedia" from Figma: full-text search across all of Atlas.
 *
 * The field is a WAI-ARIA combobox: focus stays in it while ↑ / ↓ highlight a
 * result (aria-activedescendant), Enter opens the highlighted one — or, with
 * nothing highlighted, submits the form to the full results page. The last
 * row of the list leads there too.
 */
export default function EncyclopediaPanel() {
  const t = useMessages();
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  // "ab" opens the list with a hint; the search starts at a three-letter word.
  const searchable = isSearchable(trimmed);
  const {
    loading: searching,
    failed,
    results: hits,
  } = useDebouncedSearch<SearchHit>("/api/search", normalizeSearchQuery(query), {
    delay: 180,
    enabled: searchable,
  });
  // The highlight belongs to one set of results: new results start without one.
  const [highlight, setHighlight] = useState<{ hits: SearchHit[]; index: number }>({
    hits,
    index: -1,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useLocalizedRouter();
  const listId = useId();
  const optionId = (index: number) => `${listId}-option-${index}`;

  const open = trimmed.length >= 2 && hits.length > 0;
  // The results plus the closing "See all results" row.
  const options = open ? [...hits.map((hit) => hit.url), routes.searchFor(trimmed)] : [];
  const active = open && highlight.hits === hits ? highlight.index : -1;

  // "/" jumps to the search, as on GitHub or YouTube — unless the visitor is
  // typing elsewhere or holds a modifier (Shift is how some layouts type "/").
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey || belongsToField(event)) return;
      const input = inputRef.current;
      // Hidden on phones while a panel is open: then the key stays with the page.
      input?.focus();
      if (input && document.activeElement === input) event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    // Keys confirming an input method's composition (Japanese, Chinese…) aren't ours.
    if (event.nativeEvent.isComposing) return;
    // Esc empties the field (closing the list); the content panel's own Esc
    // leaves keys pressed in fields alone, so it doesn't close the panel too.
    if (event.key === "Escape") {
      if (!query) return;
      event.preventDefault();
      setQuery("");
      return;
    }
    if (event.key === "Enter" && active >= 0) {
      // Opens the highlighted row instead of submitting the form.
      event.preventDefault();
      const href = options[active];
      if (href) router.push(href);
      setQuery("");
      return;
    }
    if ((event.key !== "ArrowDown" && event.key !== "ArrowUp") || !options.length) return;
    event.preventDefault();
    // ↓ from the last row wraps to the first; ↑ from the first returns to the
    // field without a highlight, ↑ from there goes to the last row.
    const next =
      event.key === "ArrowDown"
        ? (active + 1) % options.length
        : active < 0
          ? options.length - 1
          : active - 1;
    setHighlight({ hits, index: next });
    if (next >= 0) document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
  };

  const status = !searchable
    ? t.search.tooShort
    : searching
      ? t.search.searching
      : failed
        ? t.search.failed
        : hits.length === 0
          ? t.search.nothing
          : hits.length === 1
            ? t.search.countOne
            : format(t.search.countMany, { count: String(hits.length) });

  return (
    // No visible heading (compact block); the name stays for screen readers.
    <section
      aria-label={t.encyclopedia.heading}
      className={cn(glassVariants({ kind: "panel" }), "max-w-full")}
    >
      {/* A search form: Enter opens the full results page (a plain GET before
          React hydrates, a client-side navigation after). */}
      <form
        role="search"
        action={routes.search}
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmed) router.push(routes.searchFor(trimmed));
        }}
      >
        <label className="group/search flex min-h-(--touch-min) items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3.5 focus-within:border-white/60 focus-within:ring-2 focus-within:ring-white/70">
          <Search size={15} strokeWidth={1.7} className="shrink-0 text-white/60" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            name="q"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={active >= 0 ? optionId(active) : undefined}
            autoComplete="off"
            enterKeyHint="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t.search.placeholder}
            aria-label={t.search.placeholder}
            aria-keyshortcuts="/"
            // 16 px on phones: smaller text makes iOS zoom the page on focus.
            className="min-h-10 w-full min-w-0 bg-transparent text-base text-white placeholder:text-white/60 focus:outline-none sm:text-[13px] [&::-webkit-search-cancel-button]:hidden"
          />
          {/* Shortcut hint for keyboard users; aria-keyshortcuts tells screen readers. */}
          {query ? null : (
            <kbd
              aria-hidden
              className="flex shrink-0 rounded border border-white/40 px-1.5 py-0.5 font-sans text-[11px] leading-none text-white/70 group-focus-within/search:hidden max-sm:hidden"
            >
              /
            </kbd>
          )}
        </label>
      </form>

      {trimmed.length >= 2 ? (
        <div className="panel-scroll mt-3 max-h-[min(50vh,22rem)] overflow-y-auto">
          {/* Stays in place from "Searching…" on, so the outcome — the number of
              results too — is announced; visible only while there's no list. */}
          <p role="status" className={open ? "sr-only" : "px-1 py-3 text-[12.5px] text-white/70"}>
            {status}
          </p>
          {/* The rows are links (they work with a mouse, a middle click, before
              hydration) that keyboard users reach with the arrow keys, not Tab. */}
          {open ? (
            <div
              id={listId}
              role="listbox"
              aria-label={t.encyclopedia.heading}
              className="space-y-1"
            >
              {hits.map((hit, index) => (
                <Link
                  key={hit.id}
                  id={optionId(index)}
                  href={hit.url}
                  role="option"
                  aria-selected={active === index}
                  tabIndex={-1}
                  onClick={() => setQuery("")}
                  className={OPTION_CLASS}
                >
                  <span className="flex items-center gap-2">
                    <span className="shrink-0 rounded-full bg-white/12 px-1.5 py-0.5 text-[9.5px] tracking-wide text-white/90 uppercase">
                      {(() => {
                        const key = searchKindKey(hit);
                        return key ? t.search[key] : hit.kind;
                      })()}
                    </span>
                    <span className="text-[13.5px] font-medium text-white">{hit.title}</span>
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-white/70">{hit.subtitle}</span>
                </Link>
              ))}
              <Link
                id={optionId(hits.length)}
                href={routes.searchFor(trimmed)}
                role="option"
                aria-selected={active === hits.length}
                tabIndex={-1}
                onClick={() => setQuery("")}
                className={cn(
                  OPTION_CLASS,
                  "flex items-center gap-1.5 text-[12.5px] font-medium text-white/90",
                )}
              >
                {t.search.seeAll}
                <ArrowRight size={13} aria-hidden />
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-2.5 hidden px-1 text-[11.5px] leading-relaxed text-white/70 sm:block">
          {t.encyclopedia.hint}
        </p>
      )}
    </section>
  );
}
