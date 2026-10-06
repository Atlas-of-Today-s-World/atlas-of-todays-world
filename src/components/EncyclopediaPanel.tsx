"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "@/components/i18n/Link";
import { TOPICS_PATH } from "@/config/navigation";
import type { SearchHit } from "@/lib/search";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { belongsToField } from "@/lib/keyboard";

const KIND_KEY = {
  region: "kindRegion",
  country: "kindCountry",
  issue: "kindIssue",
  news: "kindNews",
} as const;

/** Topics and news items share the "news" kind; the address tells them apart. */
const kindKey = (hit: SearchHit) =>
  hit.kind === "news" && hit.url.startsWith(TOPICS_PATH + "/")
    ? "kindTopic"
    : hit.kind in KIND_KEY
      ? KIND_KEY[hit.kind as keyof typeof KIND_KEY]
      : null;

/** "Global Encyclopedia" from Figma: full-text search across all of Atlas. */
export default function EncyclopediaPanel() {
  const t = useMessages();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setHits(data.results ?? []);
      } catch {
        /* request aborted while typing */
      } finally {
        setSearching(false);
      }
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

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
      className="glass pointer-events-auto w-full rounded-[var(--radius-panel)] p-2 shadow-2xl shadow-black/40 sm:w-[min(92vw,22rem)] sm:p-3"
    >
      <label className="group/search flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3.5 py-2">
        <Search size={15} strokeWidth={1.7} className="text-white/60" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          // Esc empties the field; the content panel leaves Esc in fields alone.
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.preventDefault();
              setQuery("");
            }
          }}
          placeholder={t.search.placeholder}
          aria-label={t.search.placeholder}
          aria-keyshortcuts="/"
          // 16 px on phones: smaller text makes iOS zoom the page on focus.
          className="w-full bg-transparent text-base text-white placeholder:text-white/60 focus:outline-none sm:text-[13px]"
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

      {query.trim().length >= 2 ? (
        <div className="panel-scroll mt-3 max-h-[min(50vh,22rem)] overflow-y-auto">
          {hits.length === 0 ? (
            <p className="px-1 py-3 text-[12.5px] text-white/70">
              {searching ? t.search.searching : t.search.nothing}
            </p>
          ) : (
            <ul className="space-y-1">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <Link
                    href={hit.url}
                    onClick={() => setQuery("")}
                    className="block rounded-xl px-3 py-2 transition hover:bg-white/10"
                  >
                    <span className="flex items-center gap-2">
                      <span className="rounded-full bg-white/12 px-1.5 py-0.5 text-[9.5px] tracking-wide text-white/90 uppercase">
                        {(() => {
                          const key = kindKey(hit);
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
