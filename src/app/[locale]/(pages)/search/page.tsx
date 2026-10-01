import type { Metadata } from "next";
import Link from "@/components/i18n/Link";
import { search } from "@/lib/search";
import { buttonVariants } from "@/components/ui/button";
import { localePath } from "@/features/i18n/config";
import { format, getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";

/**
 * Serverová stránka výsledků. Existuje kvůli SearchAction ve strukturovaných
 * datech (Google z ní umí nabídnout vyhledávací pole přímo ve výsledcích) a
 * pro uživatele bez JavaScriptu. Samotné výsledky se neindexují.
 */
type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const t = getMessages(await localeFrom(params)).searchPage;
  return { title: t.title, description: t.description, robots: { index: false, follow: true } };
}

const KIND_KEY = {
  region: "kindRegion",
  country: "kindCountry",
  issue: "kindIssue",
  news: "kindNews",
} as const;

export default async function SearchPage({
  params,
  searchParams,
}: Params & {
  searchParams: Promise<{ q?: string }>;
}) {
  const locale = await localeFrom(params);
  const messages = getMessages(locale);
  const t = messages.searchPage;
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query ? await search(query, 40) : [];

  return (
    <main>
      <h1 className="font-display text-[34px] font-bold">{t.title}</h1>

      <form action={localePath(locale, "/search")} method="get" className="mt-6 flex gap-2">
        <input
          name="q"
          type="search"
          aria-label={t.title}
          defaultValue={query}
          placeholder={t.placeholder}
          className="w-full rounded-full border border-[var(--color-line)] px-4 py-2.5 text-[14px] text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none"
        />
        <button type="submit" className={buttonVariants({ className: "shrink-0" })}>
          {t.submit}
        </button>
      </form>

      {query ? (
        <p className="mt-5 text-[13px] text-[var(--color-ink-muted)]">
          {format(results.length === 1 ? t.resultsOne : t.resultsMany, {
            count: String(results.length),
            query,
          })}
        </p>
      ) : null}

      <ul className="mt-6 divide-y divide-[var(--color-line)]">
        {results.map((hit) => (
          <li key={hit.id} className="py-4">
            <Link href={hit.url} className="group block">
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[10px] tracking-wide text-[var(--color-accent)] uppercase">
                  {hit.kind in KIND_KEY
                    ? messages.search[KIND_KEY[hit.kind as keyof typeof KIND_KEY]]
                    : hit.kind}
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
        <p className="mt-6 text-[14px] text-[var(--color-ink-soft)]">{t.nothing}</p>
      ) : null}
    </main>
  );
}
