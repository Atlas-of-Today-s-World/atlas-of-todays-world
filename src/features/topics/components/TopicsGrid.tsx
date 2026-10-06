"use client";

import { useSearchParams } from "next/navigation";
import Link from "@/components/i18n/Link";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { format } from "@/features/i18n/messages";
import { cssBackgroundImage } from "@/lib/security/urls";
import { TOPICS_PATH } from "@/config/navigation";

export interface TopicCard {
  slug: string;
  title: string;
  summary: string;
  hero?: string;
  /** Name of the topic's region, over the title. */
  place?: string | null;
}

type Kind = "country" | "region" | "issue";

/** Place key → topic slugs and place key → name, per kind (as on the globe). */
export type TopicFilters = Record<Kind, Record<string, string[]>>;
export type PlaceNames = Record<Kind, Record<string, string>>;

const KINDS: Kind[] = ["country", "region", "issue"];

/**
 * The Topics list. `?country=ita`, `?region=…` or `?issue=…` (from "See all
 * topics" on a country, region or global issue) narrows it to that place; the
 * page itself stays static, the filter runs in the browser.
 */
export function TopicsGrid({
  items,
  filters,
  names,
  params = null,
}: {
  items: TopicCard[];
  filters: TopicFilters;
  names: PlaceNames;
  /** The page's search params; null in the static render (everything listed). */
  params?: Pick<URLSearchParams, "get"> | null;
}) {
  const t = useMessages().topics;
  const kind = KINDS.find((key) => params?.get(key));
  const raw = kind ? (params?.get(kind) ?? "") : "";
  const key = kind === "country" ? raw.toUpperCase() : raw;
  const name = kind ? names[kind][key] : undefined;
  const allowed = kind ? new Set(filters[kind][key] ?? []) : null;
  const shown = allowed ? items.filter((item) => allowed.has(item.slug)) : items;

  return (
    <>
      {kind ? (
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="font-display text-[22px] font-bold">
            {format(t.filteredBy, { name: name ?? raw })}
          </h2>
          <Link
            href={TOPICS_PATH}
            className="flex min-h-11 items-center text-[13.5px] text-[var(--color-link)] hover:underline"
          >
            {t.clearFilter}
          </Link>
        </div>
      ) : null}
      {shown.length ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((item) => {
            const image = cssBackgroundImage(item.hero);
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
                    {item.place ? (
                      <span className="text-[11px] font-medium tracking-[0.1em] text-[var(--color-ink-muted)] uppercase">
                        {item.place}
                      </span>
                    ) : null}
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
        <p className="text-[14px] text-[var(--color-ink-muted)]">
          {kind ? format(t.filterNone, { name: name ?? raw }) : t.empty}
        </p>
      )}
    </>
  );
}

/** The list with the filter from the URL (render inside <Suspense>). */
export function FilteredTopicsGrid(props: Omit<Parameters<typeof TopicsGrid>[0], "params">) {
  return <TopicsGrid {...props} params={useSearchParams()} />;
}
