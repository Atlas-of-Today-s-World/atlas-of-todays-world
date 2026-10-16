"use client";

import { FilterHeader } from "@/components/atlas/FilterHeader";
import { EmptyNote } from "@/components/atlas/Note";
import { PhotoCard } from "@/components/atlas/PhotoCard";
import { activeFilter, useUrlParams } from "@/components/atlas/url-filters";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { StatusMark } from "@/components/portrait/ContentStatusBadge";
import type { ContentStatus } from "@/features/geography/content-status";
import { format } from "@/lib/i18n/messages";
import { PHOTO_WIDTH } from "@/lib/images";
import { queryWords } from "@/features/topics/text-search";
import {
  ISSUE_FILTER_KINDS as KINDS,
  matchesQuery,
  type IssueFilterKind as Kind,
  type IssueFilters,
} from "../issue-index";
import { routes } from "@/config/routes";

export interface IssueCard {
  slug: string;
  name: string;
  subtitle: string;
  summary: string;
  /** The issue's photo; without one, its colour on the map. */
  hero: string | null;
  fill: string;
  /** Topics counted on the issue (the same number as its pill on the globe). */
  topics: number;
  status: ContentStatus;
  /** Names of its countries: the search finds "Ukraine" in the war's card. */
  places: string;
}

/**
 * The Global issues overview: the same look as the Topics list — title and
 * intro with the filter panel beside them, a photo card per issue — with a
 * place filter (country, region or custom region, through the issue's member
 * countries; issue-index.ts) and a search over the cards themselves. The page
 * stays static: filter and query live in the URL and run in the browser.
 */
export function IssuesBrowser({
  title,
  intro,
  items,
  filters,
  names,
}: {
  /** Title and intro of the page; the filter panel sits beside them on wide screens. */
  title: string;
  intro: string;
  items: IssueCard[];
  filters: IssueFilters;
  /** Place key → name, per kind (only places with at least one issue). */
  names: Record<Kind, Record<string, string>>;
}) {
  const messages = useMessages();
  const t = messages.globalIssues;
  const params = useUrlParams();
  const filter = activeFilter(params, KINDS);
  const filterName = filter ? (names[filter.kind][filter.key] ?? filter.key) : "";
  const query = params.get("q") ?? "";
  const searching = queryWords(query).length > 0;

  const inFilter = filter ? new Set(filters[filter.kind][filter.key] ?? []) : null;
  const shown = items.filter(
    (item) =>
      (!inFilter || inFilter.has(item.slug)) &&
      matchesQuery(`${item.name} ${item.subtitle} ${item.summary} ${item.places}`, query),
  );

  const selects = (
    [
      ["country", t.filterCountry, t.allCountries],
      ["region", t.filterRegion, t.allRegions],
      ["custom-region", t.filterCustomRegion, t.allCustomRegions],
    ] as const
  ).map(([kind, label, allLabel]) => ({
    kind,
    label,
    allLabel,
    options: Object.entries(names[kind]).sort(([, a], [, b]) => a.localeCompare(b)),
  }));
  const status: Record<ContentStatus, string> = {
    ready: t.statusReady,
    preparing: t.statusPreparing,
    none: "",
  };

  return (
    <div className="pl-clear-globe-7xl mx-auto max-w-7xl px-4 pt-12 pb-6 sm:pt-16 sm:pr-8">
      <FilterHeader
        id="issues"
        title={title}
        intro={intro}
        query={query}
        filter={filter}
        selects={selects}
        texts={{
          legend: t.filters,
          search: t.search,
          searchPlaceholder: t.searchPlaceholder,
          clear: t.clearFilter,
          hint: t.filterHint,
        }}
      />

      <section aria-live="polite">
        {filter ? (
          <h2 className="font-display mt-8 text-[22px] font-bold">
            {format(t.relatedWith, { name: filterName })}
          </h2>
        ) : null}
        {searching ? (
          <p className="mt-8 text-[13px] font-medium text-[var(--color-ink-muted)]">
            {shown.length === 1
              ? t.resultsOne
              : format(t.resultsCount, { count: String(shown.length) })}
          </p>
        ) : null}
        {shown.length ? (
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((item, index) => (
              <li key={item.slug}>
                <PhotoCard
                  href={routes.issue(item.slug)}
                  image={item.hero}
                  background={item.fill}
                  width={PHOTO_WIDTH.card}
                  // The first card's photo is the page's largest element (LCP).
                  priority={index === 0}
                  shade
                  // As the issue's tile over the map: its topic count and how far the editors are.
                  kicker={
                    <span className="flex items-center gap-1.5">
                      {item.topics === 1
                        ? messages.map.topicsOne
                        : format(messages.map.topicsCount, { count: String(item.topics) })}
                      {status[item.status] ? (
                        <>
                          <span aria-hidden>·</span>
                          <StatusMark status={item.status} />
                          {status[item.status]}
                        </>
                      ) : null}
                    </span>
                  }
                  title={item.name}
                  description={
                    <>
                      {item.subtitle ? (
                        <strong className="font-medium text-[var(--color-ink)]">
                          {item.subtitle}.{" "}
                        </strong>
                      ) : null}
                      {item.summary}
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyNote tone="muted" className="mt-8">
            {searching
              ? t.noResults
              : filter
                ? format(t.filterNone, { name: filterName })
                : t.empty}
          </EmptyNote>
        )}
      </section>
    </div>
  );
}
