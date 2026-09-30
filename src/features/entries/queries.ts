import "server-only";
import { unstable_cache } from "next/cache";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import type { NewsCategory } from "@/lib/content-types";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { createPublicClient } from "@/lib/supabase/public";

/** Zveřejněná novinka bez těla — pro seznamy, portréty, sitemapu. */
export interface EntrySummary {
  slug: string;
  title: string;
  summary: string;
  category: NewsCategory;
  /** Slug regionu, pod který novinka patří. */
  region: string | null;
  /** Slug global issue, pokud k němu novinka patří. */
  issue: string | null;
  countries: string[];
  hero?: string;
  heroCredit?: string;
  author?: string;
  published?: string;
  updated?: string;
  readingMinutes?: number;
}

export interface Entry extends EntrySummary {
  /** Vyčištěné HTML (sanitizace při uložení i tady při čtení). */
  html: string;
}

// Anon smí jen vyjmenované sloupce (DB-08) — nikdy select *.
const COLUMNS =
  "slug, title, summary, category, region_slug, special_slug, cover_url, cover_credit, author_name, published_on, updated_at, reading_minutes, entry_countries(country_iso3)";

interface Row {
  slug: string;
  title: string;
  summary: string;
  category: string;
  region_slug: string | null;
  special_slug: string | null;
  cover_url: string | null;
  cover_credit: string | null;
  author_name: string | null;
  published_on: string | null;
  updated_at: string;
  reading_minutes: number | null;
  entry_countries: { country_iso3: string }[];
}

function toSummary(row: Row): EntrySummary {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    category: row.category as NewsCategory,
    region: row.region_slug,
    issue: row.special_slug,
    countries: row.entry_countries.map((item) => item.country_iso3),
    hero: row.cover_url ?? undefined,
    heroCredit: row.cover_credit ?? undefined,
    author: row.author_name ?? undefined,
    published: row.published_on ?? undefined,
    updated: row.updated_at.slice(0, 10),
    readingMinutes: row.reading_minutes ?? undefined,
  };
}

/** Všechny zveřejněné novinky, od nejnovější. */
export const getEntries = unstable_cache(
  async (): Promise<EntrySummary[]> => {
    const { data, error } = await createPublicClient()
      .from("entries")
      .select(COLUMNS)
      .eq("status", "published")
      .eq("kind", "news")
      .order("published_on", { ascending: false, nullsFirst: false })
      .limit(1000);
    if (error) throw new Error(`[entries] ${error.message}`);
    return (data as Row[]).map(toSummary);
  },
  ["entries"],
  { tags: [tags.entries], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

/** Jedna zveřejněná novinka i s textem; null, když neexistuje. */
export function getEntry(slug: string): Promise<Entry | null> {
  return unstable_cache(
    async (): Promise<Entry | null> => {
      const { data, error } = await createPublicClient()
        .from("entries")
        .select(`${COLUMNS}, body_html`)
        .eq("status", "published")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new Error(`[entries] ${error.message}`);
      if (!data) return null;
      const row = data as Row & { body_html: string };
      return { ...toSummary(row), html: sanitizeRichHtml(row.body_html) };
    },
    ["entry", slug],
    { tags: [tags.entries, tags.entry(slug)], revalidate: PUBLIC_REVALIDATE_SECONDS },
  )();
}

export const entriesOfRegion = (entries: EntrySummary[], region: string) =>
  entries.filter((entry) => entry.region === region);

export const entriesOfCountry = (entries: EntrySummary[], iso3: string) =>
  entries.filter((entry) => entry.countries.includes(iso3));

/** Novinky přiřazené přímo ke global issue, za nimi ty, které zasáhly některou z jeho zemí. */
export function entriesOfIssue(entries: EntrySummary[], issue: string, countries: string[]) {
  const members = new Set(countries);
  const tagged = entries.filter((entry) => entry.issue === issue);
  const related = entries.filter(
    (entry) => entry.issue !== issue && entry.countries.some((iso3) => members.has(iso3)),
  );
  return [...tagged, ...related];
}
