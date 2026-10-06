"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "@/components/i18n/Link";
import type { SearchHit } from "@/lib/search";
import { useMessages } from "@/components/i18n/LocaleProvider";

const KIND_KEY = {
  region: "kindRegion",
  country: "kindCountry",
  issue: "kindIssue",
  news: "kindNews",
} as const;

/** "Global Encyclopedia" from Figma: full-text search across all of Atlas. */
export default function EncyclopediaPanel() {
  const t = useMessages();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

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

  return (
    // No visible heading (compact block); the name stays for screen readers.
    <section
      aria-label={t.encyclopedia.heading}
      className="glass pointer-events-auto w-[min(92vw,22rem)] rounded-[var(--radius-panel)] p-3 shadow-2xl shadow-black/40"
    >
      <label className="flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3.5 py-2">
        <Search size={15} strokeWidth={1.7} className="text-white/60" aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.search.placeholder}
          aria-label={t.search.placeholder}
          className="w-full bg-transparent text-[13px] text-white placeholder:text-white/45 focus:outline-none"
        />
      </label>

      {query.trim().length >= 2 ? (
        <div className="panel-scroll mt-3 max-h-[min(50vh,22rem)] overflow-y-auto">
          {hits.length === 0 ? (
            <p className="px-1 py-3 text-[12.5px] text-white/55">
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
                      <span className="rounded-full bg-white/12 px-1.5 py-0.5 text-[9.5px] tracking-wide text-white/70 uppercase">
                        {hit.kind in KIND_KEY
                          ? t.search[KIND_KEY[hit.kind as keyof typeof KIND_KEY]]
                          : hit.kind}
                      </span>
                      <span className="text-[13.5px] font-medium text-white">{hit.title}</span>
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-white/55">{hit.subtitle}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="mt-2.5 px-1 text-[11.5px] leading-relaxed text-white/50">
          {t.encyclopedia.hint}
        </p>
      )}
    </section>
  );
}
