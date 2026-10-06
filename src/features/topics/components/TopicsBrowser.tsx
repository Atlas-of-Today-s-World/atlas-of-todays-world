"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "@/components/i18n/Link";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { format } from "@/features/i18n/messages";
import { cn } from "@/lib/cn";
import { cssBackgroundImage } from "@/lib/security/urls";
import {
  filterFromParams,
  matchesFilter,
  TOPIC_FILTER_KINDS,
  type PlaceIndex,
  type TopicFilterKind,
} from "../filter";
import { queryWords, type TopicHit } from "../text-search";

export interface TopicCardData {
  slug: string;
  title: string;
  summary: string;
  hero?: string;
  regionName: string | null;
  region: string | null;
  issue: string | null;
  countries: string[];
}

export interface PlaceOption {
  value: string;
  label: string;
}

// The filter and the search text live in the URL (shareable, back button), read
// as an external store: the server renders the unfiltered list (search engines).
const URL_EVENT = "atlas:topics-url";
const subscribe = (onChange: () => void) => {
  window.addEventListener("popstate", onChange);
  window.addEventListener(URL_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(URL_EVENT, onChange);
  };
};
const readSearch = () => window.location.search;
const noSearch = () => "";

function setParams(update: Record<string, string | null>) {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(update)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
  );
  window.dispatchEvent(new Event(URL_EVENT));
}

const FIELD =
  "min-h-11 w-full rounded-xl border border-[var(--color-field-border)] bg-white px-3 text-[14px] text-[var(--color-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none";
const LABEL = "text-[11px] font-medium tracking-[0.1em] text-[var(--color-ink-muted)] uppercase";

/**
 * Topics list with one place filter (country, region or special region — a
 * new choice replaces the old one) and a full-text search inside the topics'
 * chapters, showing an excerpt and a link to the chapter where it occurs.
 */
export function TopicsBrowser({
  topics,
  options,
  places,
}: {
  topics: TopicCardData[];
  options: Record<TopicFilterKind, PlaceOption[]>;
  places: PlaceIndex;
}) {
  const t = useMessages().topics;
  const search = useSyncExternalStore(subscribe, readSearch, noSearch);
  const params = new URLSearchParams(search);
  const filter = filterFromParams(params);
  const query = params.get("q") ?? "";
  const searching = queryWords(query).length > 0;

  const shown = filter ? topics.filter((topic) => matchesFilter(topic, filter, places)) : topics;
  const allowed = new Set(shown.map((topic) => topic.slug));

  const [result, setResult] = useState<{ query: string; hits: TopicHit[] } | null>(null);
  useEffect(() => {
    const trimmed = query.trim();
    if (!queryWords(trimmed).length) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/topics/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { results?: TopicHit[] };
        setResult({ query: trimmed, hits: data.results ?? [] });
      } catch {
        // Aborted while typing, or the limit was hit: the previous results stay.
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const loading = searching && result?.query !== query.trim();
  const hits = (result?.hits ?? []).filter((hit) => allowed.has(hit.slug));
  const labels: Record<TopicFilterKind, string> = {
    country: t.filterCountry,
    region: t.filterRegion,
    special: t.filterSpecial,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5">
        <div>
          <label htmlFor="topics-search" className={LABEL}>
            {t.search}
          </label>
          <span className="relative mt-1.5 block">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-ink-muted)]"
            />
            <input
              id="topics-search"
              type="search"
              value={query}
              onChange={(event) => setParams({ q: event.target.value || null })}
              placeholder={t.searchPlaceholder}
              maxLength={200}
              className={cn(FIELD, "pl-9")}
            />
          </span>
        </div>

        <fieldset className="mt-4">
          <legend className="sr-only">{t.filters}</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {TOPIC_FILTER_KINDS.map((kind) => (
              <div key={kind}>
                <label htmlFor={`topics-filter-${kind}`} className={cn(LABEL, "block")}>
                  {labels[kind]}
                </label>
                <select
                  id={`topics-filter-${kind}`}
                  value={filter?.kind === kind ? filter.value : ""}
                  // One filter at a time: picking one clears the other two.
                  onChange={(event) =>
                    setParams(
                      Object.fromEntries(
                        TOPIC_FILTER_KINDS.map((other) => [
                          other,
                          other === kind ? event.target.value || null : null,
                        ]),
                      ),
                    )
                  }
                  className={cn(
                    FIELD,
                    "mt-1.5",
                    filter?.kind === kind && "border-[var(--color-accent)]",
                  )}
                >
                  <option value="">{t.filterAll}</option>
                  {options[kind].map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-3 flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1">
            <p className="text-[12px] text-[var(--color-ink-muted)]">{t.filterHint}</p>
            {filter ? (
              <button
                type="button"
                onClick={() => setParams({ country: null, region: null, special: null })}
                className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-[var(--color-link)] hover:underline"
              >
                <X aria-hidden className="size-4" />
                {t.clearFilter}
              </button>
            ) : null}
          </div>
        </fieldset>
      </div>

      {searching ? (
        <section aria-live="polite" aria-busy={loading} className="mt-8">
          <h2 className="text-[13px] font-medium text-[var(--color-ink-muted)]">
            {loading
              ? t.searching
              : hits.length === 1
                ? t.resultsOne
                : format(t.resultsCount, { count: String(hits.length) })}
          </h2>
          {!loading && !hits.length ? (
            <p className="mt-3 text-[14px] text-[var(--color-ink-soft)]">{t.noResults}</p>
          ) : (
            <ul className="mt-3 grid gap-3">
              {hits.map((hit) => (
                <li key={`${hit.slug}#${hit.anchor ?? ""}`}>
                  <Link
                    href={`/topics/${hit.slug}${hit.anchor ? `#${hit.anchor}` : ""}`}
                    className="group block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none sm:p-5"
                  >
                    <span className={LABEL}>{format(t.inTopic, { topic: hit.topicTitle })}</span>
                    <span className="font-display mt-1 block text-[17px] leading-snug font-bold group-hover:text-[var(--color-accent)]">
                      {hit.anchor ? hit.heading : t.introPart}
                    </span>
                    <span className="mt-2 block text-[13.5px] leading-relaxed text-[var(--color-ink-soft)]">
                      {hit.excerpt.map((segment, index) =>
                        segment.match ? (
                          <mark
                            key={index}
                            className="rounded bg-[var(--color-gold-light)] px-0.5 text-[var(--color-ink)]"
                          >
                            {segment.text}
                          </mark>
                        ) : (
                          <span key={index}>{segment.text}</span>
                        ),
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : shown.length ? (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((item) => {
            const image = cssBackgroundImage(item.hero);
            return (
              <li key={item.slug}>
                <Link
                  href={`/topics/${item.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
                >
                  <span
                    aria-hidden
                    className="relative block aspect-[16/10] bg-[var(--color-ink)] bg-cover bg-center"
                    style={image ? { backgroundImage: image } : undefined}
                  >
                    <span className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-80 transition group-hover:opacity-100" />
                  </span>
                  <span className="flex flex-1 flex-col p-5">
                    {item.regionName ? <span className={LABEL}>{item.regionName}</span> : null}
                    <span className="font-display mt-1.5 text-[19px] leading-snug font-bold group-hover:text-[var(--color-accent)]">
                      {item.title}
                    </span>
                    <span className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-[var(--color-ink-soft)]">
                      {item.summary}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-8 text-[14px] text-[var(--color-ink-muted)]">
          {topics.length ? t.noTopics : t.empty}
        </p>
      )}
    </div>
  );
}
