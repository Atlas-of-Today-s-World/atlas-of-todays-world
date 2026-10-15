/**
 * The Global issues overview (/global-issues): which issues a place filter
 * keeps, and the text search over the cards. Pure and without a server
 * dependency — the page computes the filters once, the browser applies them.
 *
 * A global issue is stored as its member countries (special_region_countries),
 * so every place filter goes through them:
 *
 * - a country: the issues it is a member of;
 * - an Atlas region: the issues with at least one member country in it;
 * - a custom region: the issues sharing at least one country with it.
 */
import { fold, queryWords } from "@/features/topics/text-search";

/** The selects of the overview, as query parameters (`?country=ukr`, `?custom-region=…`). */
export const ISSUE_FILTER_KINDS = ["country", "region", "custom-region"] as const;
export type IssueFilterKind = (typeof ISSUE_FILTER_KINDS)[number];

/** Place key (ISO3, region slug, custom region slug) → slugs of its issues, per kind. */
export type IssueFilters = Record<IssueFilterKind, Record<string, string[]>>;

interface Group {
  slug: string;
  countries: readonly string[];
}

function add(target: Record<string, string[]>, key: string, slug: string) {
  const list = (target[key] ??= []);
  if (!list.includes(slug)) list.push(slug);
}

export function issueFilters(
  issues: readonly Group[],
  places: {
    /** ISO3 → slug of the country's Atlas region. */
    regionOf: Readonly<Record<string, string | undefined>>;
    customRegions: readonly Group[];
  },
): IssueFilters {
  const filters: IssueFilters = { country: {}, region: {}, "custom-region": {} };
  for (const issue of issues) {
    const members = new Set(issue.countries);
    for (const iso3 of members) {
      add(filters.country, iso3, issue.slug);
      const region = places.regionOf[iso3];
      if (region) add(filters.region, region, issue.slug);
    }
    for (const custom of places.customRegions) {
      if (custom.countries.some((iso3) => members.has(iso3)))
        add(filters["custom-region"], custom.slug, issue.slug);
    }
  }
  return filters;
}

/**
 * Does a card match the search? Every word of the query (as on the Topics
 * page: at least two letters, case and accents ignored) must start a word of
 * its text — name, subtitle, summary and the names of its countries.
 */
export function matchesQuery(text: string, query: string): boolean {
  const words = queryWords(query);
  if (!words.length) return true;
  const own = fold(text).split(/[^\p{L}\p{N}]+/u);
  return words.every((word) => own.some((part) => part.startsWith(word)));
}
