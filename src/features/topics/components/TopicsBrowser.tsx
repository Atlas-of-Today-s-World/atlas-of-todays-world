"use client";

import { Search, X } from "lucide-react";
import { TopicsInvite } from "@/components/topics/TopicsInvite";
import { type ReactNode, useSyncExternalStore } from "react";
import Link from "@/components/i18n/Link";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { Button } from "@/components/ui/button";
import { TOPICS_PATH } from "@/config/navigation";
import { format } from "@/features/i18n/messages";
import { cn } from "@/lib/cn";
import { cssBackgroundImage } from "@/lib/security/urls";
import { PHOTO_WIDTH } from "@/lib/images";
import { useDebouncedSearch } from "@/lib/use-debounced-search";
import { queryWords, type TopicHit } from "../text-search";

export interface TopicCard {
  slug: string;
  title: string;
  summary: string;
  hero?: string;
  /** Name of the topic's region, over the title. */
  place?: string | null;
}

/** Places to filter by: country, region, or special region (global issue / custom region). */
type Kind = "country" | "region" | "issue";
const KINDS: readonly Kind[] = ["country", "region", "issue"];

/** Place key → topic slugs and place key → name, per kind (as the counts on the globe). */
export type TopicFilters = Record<Kind, Record<string, string[]>>;
export type PlaceNames = Record<Kind, Record<string, string>>;

/**
 * The one active place filter from the URL — `?country=ita`, `?region=…` or
 * `?issue=…` (also what "See all topics" on a country or portrait links to).
 */
function filterFrom(params: URLSearchParams): { kind: Kind; key: string } | null {
  for (const kind of KINDS) {
    const value = params.get(kind);
    if (value) return { kind, key: kind === "country" ? value.toUpperCase() : value };
  }
  return null;
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
 * The Topics list: one place filter (country, region or special region — a
 * new choice replaces the old one; the same topics as the counts on the globe)
 * and a full-text search inside the topics showing an excerpt and a link to
 * the chapter where it occurs. The page stays static: filter and query live
 * in the URL and run in the browser.
 */
export function TopicsBrowser({
  items,
  filters,
  names,
  regionOf = {},
  heading,
}: {
  /** Title and intro of the page; the search panel sits beside them on wide screens. */
  heading: ReactNode;
  items: TopicCard[];
  filters: TopicFilters;
  names: PlaceNames;
  /** ISO3 → name of the country's region, for "related to Poland or Western & Central Europe". */
  regionOf?: Record<string, string>;
}) {
  const messages = useMessages();
  const t = messages.topics;
  const search = useSyncExternalStore(subscribe, readSearch, noSearch);
  const params = new URLSearchParams(search);
  const filter = filterFrom(params);
  const filterName = filter ? (names[filter.kind][filter.key] ?? filter.key) : "";
  // A country's list also holds its region's topics — the heading says so.
  const filterRegion = filter?.kind === "country" ? regionOf[filter.key] : undefined;
  const query = params.get("q") ?? "";
  const searching = queryWords(query).length > 0;

  const inFilter = filter ? new Set(filters[filter.kind][filter.key] ?? []) : null;
  const shown = inFilter ? items.filter((item) => inFilter.has(item.slug)) : items;
  const allowed = new Set(shown.map((topic) => topic.slug));

  const { loading, failed, results, retry } = useDebouncedSearch<TopicHit>(
    "/api/topics/search",
    query.trim(),
    { delay: 250, enabled: searching },
  );
  const hits = results.filter((hit) => allowed.has(hit.slug));
  const labels: Record<Kind, string> = {
    country: t.filterCountry,
    region: t.filterRegion,
    issue: t.filterSpecial,
  };
  const allLabels: Record<Kind, string> = {
    country: t.allCountries,
    region: t.allRegions,
    issue: t.allSpecial,
  };
  // Only places with at least one topic, alphabetically.
  const options = (kind: Kind) =>
    Object.entries(names[kind])
      .filter(([key]) => filters[kind][key]?.length)
      .sort(([, a], [, b]) => a.localeCompare(b));

  return (
    <div className="mx-auto max-w-7xl px-4 pt-12 pb-6 sm:px-8 sm:pt-16">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:items-end">
        <div>{heading}</div>
        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
          <fieldset className="grid gap-2 sm:grid-cols-3">
            <legend className="sr-only">{t.filters}</legend>
            <span className="relative col-span-full flex items-center gap-1">
              <label htmlFor="topics-search" className="sr-only">
                {t.search}
              </label>
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
              {filter ? (
                <button
                  type="button"
                  onClick={() => setParams({ country: null, region: null, issue: null })}
                  aria-label={t.clearFilter}
                  title={t.clearFilter}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-medium whitespace-nowrap text-[var(--color-link)] hover:bg-[var(--color-accent-soft)]"
                >
                  <X aria-hidden className="size-4" />
                  {t.clearFilter}
                </button>
              ) : null}
            </span>
            {KINDS.map((kind) => (
              <span key={kind} className="block">
                <label htmlFor={`topics-filter-${kind}`} className="sr-only">
                  {labels[kind]}
                </label>
                <select
                  id={`topics-filter-${kind}`}
                  value={filter?.kind === kind ? filter.key : ""}
                  title={t.filterHint}
                  // One filter at a time: picking one clears the other two.
                  onChange={(event) =>
                    setParams(
                      Object.fromEntries(
                        KINDS.map((other) => [
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
                  <option value="">{allLabels[kind]}</option>
                  {options(kind).map(([key, name]) => (
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

      {searching ? (
        <section aria-live="polite" aria-busy={loading} className="mt-8">
          <h2 className="text-[13px] font-medium text-[var(--color-ink-muted)]">
            {loading
              ? t.searching
              : failed
                ? messages.search.failed
                : hits.length === 1
                  ? t.resultsOne
                  : format(t.resultsCount, { count: String(hits.length) })}
          </h2>
          {failed ? (
            <Button variant="outline" size="sm" onClick={retry} className="mt-3">
              {messages.panel.tryAgain}
            </Button>
          ) : !loading && !hits.length ? (
            <p className="mt-3 text-[14px] text-[var(--color-ink-soft)]">{t.noResults}</p>
          ) : (
            <ul className="mt-3 grid gap-3">
              {hits.map((hit) => (
                <li key={`${hit.slug}#${hit.anchor ?? ""}`}>
                  <Link
                    href={`${TOPICS_PATH}/${hit.slug}${hit.anchor ? `#${hit.anchor}` : ""}`}
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
        <>
          {filter ? (
            <h2 className="font-display mt-8 text-[22px] font-bold">
              {filterRegion
                ? format(t.relatedWithRegion, { name: filterName, region: filterRegion })
                : format(t.relatedWith, { name: filterName })}
            </h2>
          ) : null}
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((item) => {
              const image = cssBackgroundImage(item.hero, PHOTO_WIDTH.card);
              return (
                <li key={item.slug}>
                  <Link
                    href={`${TOPICS_PATH}/${item.slug}`}
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
                      {item.place ? <span className={LABEL}>{item.place}</span> : null}
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
        </>
      ) : (
        <>
          <p className="mt-8 text-[14px] text-[var(--color-ink-muted)]">
            {filter ? format(t.filterNone, { name: filterName }) : t.empty}
          </p>
          {filter ? <TopicsInvite t={t} place={filterName} full className="mt-4 max-w-xl" /> : null}
        </>
      )}
    </div>
  );
}
