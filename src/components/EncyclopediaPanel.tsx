"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useDebouncedSearch } from "@/lib/use-debounced-search";
import Link from "@/components/i18n/Link";
import { searchKindKey } from "@/lib/search-kind";
import { useLocalizedRouter } from "@/components/i18n/useLocalizedRouter";
import type { SearchHit } from "@/lib/search";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { belongsToField } from "@/lib/keyboard";
import { routes } from "@/config/routes";

/**
 * ↑ / ↓ move between the field and the result links (and back up to the field),
 * so the list can be walked without Tab-ing through the page.
 */
function moveFocus(event: ReactKeyboardEvent, list: HTMLElement | null, input: HTMLElement | null) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const links = Array.from(list?.querySelectorAll<HTMLElement>("a[href]") ?? []);
  if (!links.length) return;
  const index = links.indexOf(document.activeElement as HTMLElement);
  const next = event.key === "ArrowDown" ? index + 1 : index - 1;
  event.preventDefault();
  if (next < 0) input?.focus();
  else links[Math.min(next, links.length - 1)]?.focus();
}

/** "Global Encyclopedia" from Figma: full-text search across all of Atlas. */
export default function EncyclopediaPanel() {
  const t = useMessages();
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const {
    loading: searching,
    failed,
    results: hits,
  } = useDebouncedSearch<SearchHit>("/api/search", trimmed, {
    delay: 180,
    enabled: trimmed.length >= 2,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useLocalizedRouter();

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

  return (
    // No visible heading (compact block); the name stays for screen readers.
    <section
      aria-label={t.encyclopedia.heading}
      className="glass pointer-events-auto w-full max-w-full rounded-[var(--radius-panel)] p-2 shadow-2xl shadow-black/40 sm:w-[min(92vw,22rem)] sm:p-3"
    >
      {/* A search form: Enter opens the full results page. */}
      <form
        role="search"
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
            enterKeyHint="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            // Esc empties the field; the content panel leaves Esc in fields alone.
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) {
                event.preventDefault();
                setQuery("");
              } else moveFocus(event, listRef.current, inputRef.current);
            }}
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
        <div
          ref={listRef}
          onKeyDown={(event) => moveFocus(event, listRef.current, inputRef.current)}
          className="panel-scroll mt-3 max-h-[min(50vh,22rem)] overflow-y-auto"
        >
          {hits.length === 0 ? (
            // Stays in place from "Searching…" on, so the outcome is announced.
            <p role="status" className="px-1 py-3 text-[12.5px] text-white/70">
              {searching ? t.search.searching : failed ? t.search.failed : t.search.nothing}
            </p>
          ) : (
            <ul className="space-y-1">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <Link
                    href={hit.url}
                    onClick={() => setQuery("")}
                    className="block rounded-xl px-3 py-2 transition hover:bg-white/10 focus-visible:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
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
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="mt-2.5 hidden px-1 text-[11.5px] leading-relaxed text-white/70 sm:block">
          {t.encyclopedia.hint}
        </p>
      )}
    </section>
  );
}
