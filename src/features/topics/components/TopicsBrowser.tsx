"use client";

import { TopicsInvite } from "@/components/topics/TopicsInvite";
import { kickerVariants } from "@/components/atlas/kicker";
import { FilterHeader } from "@/components/atlas/FilterHeader";
import { EmptyNote } from "@/components/atlas/Note";
import { PhotoCard } from "@/components/atlas/PhotoCard";
import { activeFilter, useUrlParams } from "@/components/atlas/url-filters";
import Link from "@/components/i18n/Link";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { Button } from "@/components/ui/button";
import { PLACE_KINDS as KINDS, type PlaceKind as Kind } from "@/features/geography/kinds";
import { format } from "@/lib/i18n/messages";
import { PHOTO_WIDTH } from "@/lib/images";
import { normalizeSearchQuery } from "@/lib/search-query";
import { useDebouncedSearch } from "@/lib/use-debounced-search";
import { queryWords, type TopicHit } from "../text-search";
import { routes } from "@/config/routes";

export interface TopicCard {
  slug: string;
  title: string;
  summary: string;
  hero?: string;
  /** Name of the topic's region, over the title. */
  place?: string | null;
}

/** Place key → topic slugs and place key → name, per kind (as the counts on the globe). */
export type TopicFilters = Record<Kind, Record<string, string[]>>;
export type PlaceNames = Record<Kind, Record<string, string>>;

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
  title,
  intro,
}: {
  /** Title and intro of the page; the filter panel sits beside them on wide screens. */
  title: string;
  intro: string;
  items: TopicCard[];
  filters: TopicFilters;
  names: PlaceNames;
  /** ISO3 → name of the country's region, for "related to Poland or Western & Central Europe". */
  regionOf?: Record<string, string>;
}) {
  const messages = useMessages();
  const t = messages.topics;
  const params = useUrlParams();
  // The one active place filter — `?country=ita`, `?region=…` or `?issue=…`
  // (also what "See all topics" on a country or portrait links to).
  const filter = activeFilter(params, KINDS);
  const filterName = filter ? (names[filter.kind][filter.key] ?? filter.key) : "";
  // A country's list also holds its region's topics — the heading says so.
  const filterRegion = filter?.kind === "country" ? regionOf[filter.key] : undefined;
  const query = params.get("q") ?? "";
  const searching = queryWords(query).length > 0;

  const inFilter = filter ? new Set(filters[filter.kind][filter.key] ?? []) : null;
  const shown = inFilter ? items.filter((item) => inFilter.has(item.slug)) : items;
  const allowed = new Set(shown.map((topic) => topic.slug));

  const { loading, failed, results, retry } = useDebouncedSearch<TopicHit>(
    "/api/entries/search",
    normalizeSearchQuery(query),
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
    <div className="pl-clear-globe-7xl mx-auto max-w-7xl px-4 pt-12 pb-6 sm:pt-16 sm:pr-8">
      <FilterHeader
        id="topics"
        title={title}
        intro={intro}
        query={query}
        filter={filter}
        selects={KINDS.map((kind) => ({
          kind,
          label: labels[kind],
          allLabel: allLabels[kind],
          options: options(kind),
        }))}
        texts={{
          legend: t.filters,
          search: t.search,
          searchPlaceholder: t.searchPlaceholder,
          clear: t.clearFilter,
          hint: t.filterHint,
        }}
      />

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
            <EmptyNote className="mt-3">{t.noResults}</EmptyNote>
          ) : (
            <ul className="mt-3 grid gap-3">
              {hits.map((hit) => (
                <li key={`${hit.slug}#${hit.anchor ?? ""}`}>
                  <Link
                    href={routes.entry(hit.slug, hit.anchor)}
                    className="group block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none sm:p-5"
                  >
                    <span className={kickerVariants()}>
                      {format(t.inTopic, { topic: hit.topicTitle })}
                    </span>
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
            {shown.map((item, index) => (
              <li key={item.slug}>
                <PhotoCard
                  href={routes.entry(item.slug)}
                  image={item.hero}
                  width={PHOTO_WIDTH.card}
                  // The first card's photo is the page's largest element (LCP).
                  priority={index === 0}
                  shade
                  kicker={item.place}
                  title={item.title}
                  description={item.summary}
                />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <EmptyNote tone="muted" className="mt-8">
            {filter ? format(t.filterNone, { name: filterName }) : t.empty}
          </EmptyNote>
          {filter ? <TopicsInvite t={t} place={filterName} full className="mt-4 max-w-xl" /> : null}
        </>
      )}
    </div>
  );
}
