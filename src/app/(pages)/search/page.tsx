import type { Metadata } from "next";
import Link from "next/link";
import { search } from "@/lib/search";

/**
 * Serverová stránka výsledků. Existuje kvůli SearchAction ve strukturovaných
 * datech (Google z ní umí nabídnout vyhledávací pole přímo ve výsledcích) a
 * pro uživatele bez JavaScriptu. Samotné výsledky se neindexují.
 */
export const metadata: Metadata = {
  title: "Search the Atlas",
  description: "Search every region, country and encyclopedia item of the Atlas.",
  robots: { index: false, follow: true },
};

const KIND_LABEL: Record<string, string> = {
  region: "Region",
  country: "Country",
  news: "News",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query ? await search(query, 40) : [];

  return (
    <main>
      <h1 className="font-display text-[34px] font-bold">Search the Atlas</h1>

      <form action="/search" method="get" className="mt-6 flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Try “political situation in Russia”"
          className="w-full rounded-full border border-[var(--color-line)] px-4 py-2.5 text-[14px] text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-[var(--color-accent)] px-6 py-2.5 text-[14px] font-medium text-white"
        >
          Search
        </button>
      </form>

      {query ? (
        <p className="mt-5 text-[13px] text-[var(--color-ink-muted)]">
          {results.length} result{results.length === 1 ? "" : "s"} for &ldquo;{query}
          &rdquo;
        </p>
      ) : null}

      <ul className="mt-6 divide-y divide-[var(--color-line)]">
        {results.map((hit) => (
          <li key={hit.id} className="py-4">
            <Link href={hit.url} className="group block">
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[10px] tracking-wide text-[var(--color-accent)] uppercase">
                  {KIND_LABEL[hit.kind] ?? hit.kind}
                </span>
                <span className="font-display text-[16px] font-bold text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
                  {hit.title}
                </span>
              </span>
              <span className="mt-1 block text-[12.5px] text-[var(--color-ink-muted)]">
                {hit.subtitle}
              </span>
              <span className="mt-1.5 line-clamp-2 block text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
                {hit.body}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {query && !results.length ? (
        <p className="mt-6 text-[14px] text-[var(--color-ink-soft)]">
          Nothing in the Atlas matches that yet.
        </p>
      ) : null}
    </main>
  );
}
