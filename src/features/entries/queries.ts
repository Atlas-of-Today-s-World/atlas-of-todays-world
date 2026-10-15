import "server-only";
import { unstable_cache } from "next/cache";
import { DEFAULT_LOCALE, type Locale } from "@/features/i18n/config";
import { entryPageTags, PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import type { ArticleKind, NewsCategory } from "@/lib/content-types";
import { must } from "@/lib/db/result";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { createPublicClient } from "@/lib/supabase/public";
import { MAP_LAYERS, type MapLayer } from "./constants";
import { COLUMNS, pickVersion, type Row, toLocale, toSummary } from "./rows";
import type {
  AuthorArticle,
  Entry,
  EntrySummary,
  Placed,
  TopicPlace,
  UpcomingEntry,
} from "./types";

/**
 * Public reads of published articles: the lists (news, topics, an author's
 * articles, planned entries, topic places) and the news item page. The topic
 * page is in `topic-queries.ts`, the preview by link in `preview-queries.ts`.
 */

/** Published originals of the given kind, newest first (language versions never list twice). */
function listPublished(kind: ArticleKind) {
  return unstable_cache(
    async (): Promise<EntrySummary[]> => {
      const data = must(
        await createPublicClient()
          .from("entries")
          .select(COLUMNS)
          .eq("status", "published")
          .eq("kind", kind)
          .is("translation_of", null)
          .order("published_on", { ascending: false, nullsFirst: false })
          .limit(1000),
        "entries",
      );
      return (data as Row[]).map((row) => toSummary(row, [toLocale(row.locale)]));
    },
    [kind === "news" ? "entries" : "encyclopedia"],
    { tags: [tags.entries], revalidate: PUBLIC_REVALIDATE_SECONDS },
  );
}

/** Published news (originals), newest first. */
export const getEntries = listPublished("news");

/** Published encyclopedia entries (originals), newest first. */
export const getEncyclopediaEntries = listPublished("entry");

/**
 * Cached per author (a new profile is a cache miss, not a stale list);
 * publishing revalidates `entries`.
 */
export function getArticlesByAuthor(authorSlug: string): Promise<AuthorArticle[]> {
  return unstable_cache(
    async () => {
      const data = must(
        await createPublicClient()
          .from("entries")
          .select("slug, kind, title, category, published_on, authors!inner(slug)")
          .eq("status", "published")
          .is("translation_of", null)
          .eq("authors.slug", authorSlug)
          .order("published_on", { ascending: false, nullsFirst: false })
          .limit(500),
        "entries",
      );
      return data.map((row) => ({
        kind: row.kind as ArticleKind,
        slug: row.slug,
        title: row.title,
        category: row.category as NewsCategory,
        published: row.published_on ?? undefined,
      }));
    },
    ["author-articles", authorSlug],
    { tags: [tags.entries], revalidate: PUBLIC_REVALIDATE_SECONDS },
  )();
}

/**
 * A single published news item with text (in the page language, else the
 * original); null if missing. Cached per slug (`entryPageTags`), so editing
 * another article leaves this one cached.
 */
export async function getEntry(
  slug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<Entry | null> {
  const rows = await unstable_cache(
    async () => {
      const data = must(
        await createPublicClient()
          .from("entries")
          .select(`${COLUMNS}, body_html, translation_of`)
          .eq("status", "published")
          .eq("kind", "news")
          .eq("slug", slug),
        "entries",
      );
      return data as (Row & { body_html: string; translation_of: string | null })[];
    },
    ["entry", slug],
    { tags: entryPageTags(slug), revalidate: PUBLIC_REVALIDATE_SECONDS },
  )();
  const version = pickVersion(rows, locale);
  if (!version) return null;
  return {
    ...toSummary(version.row, version.languages),
    html: sanitizeRichHtml(version.row.body_html),
    locale: version.locale,
  };
}

export const entriesOfRegion = <T extends Placed>(entries: T[], region: string) =>
  entries.filter((entry) => entry.region === region);

export const entriesOfCountry = <T extends Placed>(entries: T[], iso3: string) =>
  entries.filter((entry) => entry.countries.includes(iso3));

/** Articles assigned directly to a global issue, followed by those affecting any of its countries. */
export function entriesOfIssue<T extends Placed>(entries: T[], issue: string, countries: string[]) {
  const members = new Set(countries);
  const tagged = entries.filter((entry) => entry.issue === issue);
  const related = entries.filter(
    (entry) => entry.issue !== issue && entry.countries.some((iso3) => members.has(iso3)),
  );
  return [...tagged, ...related];
}

export const getPlannedEntries = unstable_cache(
  async (): Promise<UpcomingEntry[]> => {
    const data = must(await createPublicClient().rpc("planned_entries"), "encyclopedia");
    return data.map((row) => ({
      title: row.title,
      category: row.category as NewsCategory,
      region: row.region_slug,
      issue: row.special_slug,
      countries: row.countries,
    }));
  },
  ["planned-entries"],
  { tags: [tags.entries], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

/** Entries for the portrait section: published with a link, planned without (greyed out). */
export function thematicEntries(published: EntrySummary[], upcoming: UpcomingEntry[]) {
  return [
    ...published.map(({ title, category, slug, hero }) => ({ title, category, slug, hero })),
    ...upcoming.map(({ title, category }) => ({ title, category, slug: null })),
  ];
}

/** Published topics with where they belong on the globe (the map's topic counts). */
export const getTopicPlaces = unstable_cache(
  async (): Promise<TopicPlace[]> => {
    const data = must(
      await createPublicClient()
        .from("entries")
        .select("slug, title, region_slug, special_slug, map_layers, entry_countries(country_iso3)")
        .eq("kind", "entry")
        .eq("status", "published")
        .is("translation_of", null),
      "topics",
    );
    return data.map((row) => ({
      slug: row.slug,
      title: row.title,
      region: row.region_slug,
      issue: row.special_slug,
      countries: row.entry_countries.map((country) => country.country_iso3),
      layers: row.map_layers.filter((layer): layer is MapLayer =>
        (MAP_LAYERS as readonly string[]).includes(layer),
      ),
    }));
  },
  ["topic-places"],
  { tags: [tags.entries], revalidate: PUBLIC_REVALIDATE_SECONDS },
);
