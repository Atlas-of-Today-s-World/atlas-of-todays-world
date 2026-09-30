"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Link from "next/link";

export interface AdminNewsItem {
  slug: string;
  title: string;
  category: string;
  region: string;
  regionName: string;
  issue: string | null;
  issueName: string | null;
  countries: string[];
  published: string | null;
}

export interface AdminRegion {
  slug: string;
  name: string;
  countries: { iso3: string; name: string }[];
}

/** Global Issue ke zvolení u novinky. */
export interface AdminIssue {
  slug: string;
  name: string;
  countries: { iso3: string; name: string }[];
}

const FIELD =
  "w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-[14px] text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none";
const LABEL = "block text-[12px] font-medium text-[var(--color-ink-muted)]";

export default function AdminClient({
  newsItems,
  regions,
  issues,
  categories,
  countryNames,
}: {
  newsItems: AdminNewsItem[];
  regions: AdminRegion[];
  issues: AdminIssue[];
  categories: string[];
  countryNames: Record<string, string>;
}) {
  const router = useRouter();

  // --- formulář nové novinky ---
  const [formOpen, setFormOpen] = useState(false);
  const [regionSlug, setRegionSlug] = useState(regions[0]?.slug ?? "");
  const [issueSlug, setIssueSlug] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // --- filtry seznamu ---
  const [filterRegion, setFilterRegion] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterIssue, setFilterIssue] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [query, setQuery] = useState("");

  const region = regions.find((item) => item.slug === regionSlug);
  const issue = issues.find((item) => item.slug === issueSlug);

  // Nabídka zemí = země regionu + země zvoleného celku. Celek sahá napříč
  // regiony, takže bez toho by se jeho země nedaly u novinky zaškrtnout.
  const pickable = [
    ...(region?.countries ?? []),
    ...(issue?.countries ?? []).filter(
      (item) => !(region?.countries ?? []).some((c) => c.iso3 === item.iso3),
    ),
  ];

  /**
   * Do filtru zemí dáváme jen ty, ke kterým nějaká novinka existuje – seznam
   * všech 228 zemí by se v rozbalovačce nedal projít a většina by byla prázdná.
   * Když je zvolený region, zúží se na jeho země.
   */
  const countryOptions = useMemo(() => {
    const used = new Map<string, string>();
    for (const item of newsItems) {
      if (filterRegion && item.region !== filterRegion) continue;
      for (const iso3 of item.countries) {
        used.set(iso3, countryNames[iso3] ?? iso3);
      }
    }
    return [...used.entries()]
      .map(([iso3, name]) => ({ iso3, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [newsItems, filterRegion, countryNames]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return newsItems.filter((item) => {
      if (filterRegion && item.region !== filterRegion) return false;
      if (filterCountry && !item.countries.includes(filterCountry)) return false;
      if (filterIssue && item.issue !== filterIssue) return false;
      if (filterCategory && item.category !== filterCategory) return false;
      if (needle && !item.title.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [newsItems, filterRegion, filterCountry, filterIssue, filterCategory, query]);

  const filtering =
    Boolean(filterRegion || filterCountry || filterIssue || filterCategory) ||
    query.trim().length > 0;

  function clearFilters() {
    setFilterRegion("");
    setFilterCountry("");
    setFilterIssue("");
    setFilterCategory("");
    setQuery("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    setDone(null);

    try {
      const res = await fetch("/api/admin/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          slug: form.get("slug"),
          summary: form.get("summary"),
          category: form.get("category"),
          region: regionSlug,
          issue: issueSlug,
          countries,
          hero: form.get("hero"),
          author: form.get("author"),
          published: form.get("published"),
          markdown: form.get("markdown"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Uložení selhalo.");
      setDone(data.url);
      (event.target as HTMLFormElement).reset();
      setCountries([]);
      setIssueSlug("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Uložení selhalo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(slug: string) {
    if (!confirm(`Smazat novinku „${slug}"? Soubor se odstraní z disku.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/news?slug=${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Smazání selhalo.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Smazání selhalo.");
    } finally {
      setBusy(false);
    }
  }

  function toggleCountry(iso3: string) {
    setCountries((current) =>
      current.includes(iso3)
        ? current.filter((item) => item !== iso3)
        : [...current, iso3],
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[22px] font-bold">Novinky</h2>
          <p className="mt-1 text-[13px] text-[var(--color-ink-soft)]">
            Krátký útvar: novinka se uloží jako Markdown a objeví se v profilu
            regionu i každé označené země.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen((value) => !value)}
          aria-expanded={formOpen}
          className="min-h-11 rounded-full bg-[var(--color-accent)] px-5 text-[14px] font-medium text-white transition hover:bg-[var(--color-accent-strong)]"
        >
          {formOpen ? "Zavřít formulář" : "+ Nová novinka"}
        </button>
      </div>

      {formOpen ? (
        <section
          aria-label="Nová novinka"
          className="mt-6 rounded-xl border border-[var(--color-line)] p-6"
        >
          <h3 className="font-display text-[18px] font-bold">Nová novinka</h3>

          <form onSubmit={submit} className="mt-5 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="title">Název</label>
                <input id="title" name="title" required className={`mt-1.5 ${FIELD}`}
                  placeholder="The Regime of Vladimir Putin" />
              </div>
              <div>
                <label className={LABEL} htmlFor="slug">URL (nepovinné)</label>
                <input id="slug" name="slug" className={`mt-1.5 ${FIELD}`}
                  placeholder="odvodí se z názvu" />
              </div>
            </div>

            <div>
              <label className={LABEL} htmlFor="summary">Perex</label>
              <textarea id="summary" name="summary" required rows={2}
                className={`mt-1.5 ${FIELD}`}
                placeholder="Jedna až dvě věty do přehledu novinek a do výsledků hledání." />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="category">Kategorie</label>
                <select id="category" name="category" className={`mt-1.5 ${FIELD}`}>
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="region">Region</label>
                <select
                  id="region"
                  name="region"
                  value={regionSlug}
                  onChange={(event) => {
                    setRegionSlug(event.target.value);
                    setCountries([]);
                  }}
                  className={`mt-1.5 ${FIELD}`}
                >
                  {regions.map((item) => (
                    <option key={item.slug} value={item.slug}>{item.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={LABEL} htmlFor="news-issue">
                Global Issue{" "}
                <span className="font-normal">
                  (nepovinné – novinka se pak ukáže i v profilu celku)
                </span>
              </label>
              <select
                id="news-issue"
                name="issue"
                value={issueSlug}
                onChange={(event) => setIssueSlug(event.target.value)}
                className={`mt-1.5 ${FIELD}`}
              >
                <option value="">— žádný —</option>
                {issues.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
              {issue ? (
                <button
                  type="button"
                  onClick={() =>
                    setCountries((current) => [
                      ...current,
                      ...issue.countries
                        .map((item) => item.iso3)
                        .filter((iso3) => !current.includes(iso3)),
                    ])
                  }
                  className="mt-2 rounded-full border border-[var(--color-line)] px-3 py-1 text-[12px] text-[var(--color-ink-soft)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                >
                  + označit všech {issue.countries.length} zemí celku
                </button>
              ) : null}
            </div>

            <div>
              <span className={LABEL}>
                Země, kterých se novinka týká{" "}
                <span className="font-normal">
                  (novinka se pak ukáže v profilu každé z nich)
                </span>
              </span>
              <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-[var(--color-line)] p-2.5">
                {pickable.map((country) => {
                  const on = countries.includes(country.iso3);
                  return (
                    <button
                      type="button"
                      key={country.iso3}
                      onClick={() => toggleCountry(country.iso3)}
                      aria-pressed={on}
                      className={`rounded-full border px-2.5 py-1 text-[12px] transition ${
                        on
                          ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                          : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-accent)]"
                      }`}
                    >
                      {country.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className={LABEL} htmlFor="hero">Obrázek (URL)</label>
                <input id="hero" name="hero" type="url" className={`mt-1.5 ${FIELD}`}
                  placeholder="https://images.unsplash.com/…" />
              </div>
              <div>
                <label className={LABEL} htmlFor="published">Datum</label>
                <input id="published" name="published" type="date" className={`mt-1.5 ${FIELD}`} />
              </div>
            </div>

            <div>
              <label className={LABEL} htmlFor="author">Autor</label>
              <input id="author" name="author" className={`mt-1.5 ${FIELD}`}
                placeholder="Atlas editorial team" />
            </div>

            <div>
              <label className={LABEL} htmlFor="markdown">Text novinky (Markdown)</label>
              <textarea id="markdown" name="markdown" required rows={12}
                className={`mt-1.5 font-mono text-[13px] ${FIELD}`}
                placeholder={"Úvodní odstavec.\n\n## Mezinadpis\n\nDalší text, **tučně**, [odkaz](https://…)."} />
            </div>

            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
            ) : null}
            {done ? (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
                Uloženo.{" "}
                <Link href={done} className="font-medium underline">
                  Otevřít novinku v mapě
                </Link>
              </p>
            ) : null}

            <div>
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-[var(--color-accent)] px-6 py-2.5 text-[14px] font-medium text-white transition hover:bg-[var(--color-accent-strong)] disabled:opacity-50"
              >
                {busy ? "Ukládám…" : "Publikovat novinku"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {/* Filtry a seznam */}
      <section aria-label="Publikované novinky" className="mt-10">
        <div className="grid gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-line)]/10 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className={LABEL} htmlFor="filter-region">Region</label>
            <select
              id="filter-region"
              value={filterRegion}
              onChange={(event) => {
                setFilterRegion(event.target.value);
                setFilterCountry("");
              }}
              className={`mt-1.5 ${FIELD}`}
            >
              <option value="">Všechny</option>
              {regions.map((item) => (
                <option key={item.slug} value={item.slug}>{item.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL} htmlFor="filter-country">Země</label>
            <select
              id="filter-country"
              value={filterCountry}
              onChange={(event) => setFilterCountry(event.target.value)}
              className={`mt-1.5 ${FIELD}`}
            >
              <option value="">Všechny</option>
              {countryOptions.map((country) => (
                <option key={country.iso3} value={country.iso3}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL} htmlFor="filter-issue">Global Issue</label>
            <select
              id="filter-issue"
              value={filterIssue}
              onChange={(event) => setFilterIssue(event.target.value)}
              className={`mt-1.5 ${FIELD}`}
            >
              <option value="">Všechny</option>
              {issues.map((item) => (
                <option key={item.slug} value={item.slug}>{item.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL} htmlFor="filter-category">Kategorie</label>
            <select
              id="filter-category"
              value={filterCategory}
              onChange={(event) => setFilterCategory(event.target.value)}
              className={`mt-1.5 ${FIELD}`}
            >
              <option value="">Všechny</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL} htmlFor="filter-query">Název obsahuje</label>
            <input
              id="filter-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={`mt-1.5 ${FIELD}`}
              placeholder="Putin"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-[var(--color-ink-muted)]">
            {filtered.length === newsItems.length
              ? `${newsItems.length} novinek`
              : `${filtered.length} z ${newsItems.length} novinek`}
          </p>
          {filtering ? (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-[12.5px] text-[var(--color-ink-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              Vyčistit filtry
            </button>
          ) : null}
        </div>

        <ul className="mt-2 divide-y divide-[var(--color-line)]">
          {filtered.map((item) => (
            <li key={item.slug} className="flex items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/news/${item.slug}`}
                  className="block text-[14px] font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                >
                  {item.title}
                </Link>
                <p className="mt-0.5 text-[11.5px] text-[var(--color-ink-muted)]">
                  {item.category} · {item.regionName}
                  {item.issueName ? ` · ${item.issueName}` : ""}
                  {item.published ? ` · ${item.published}` : ""}
                </p>
                {item.countries.length ? (
                  <p className="mt-1 flex flex-wrap gap-1">
                    {item.countries.map((iso3) => (
                      <button
                        type="button"
                        key={iso3}
                        onClick={() => setFilterCountry(iso3)}
                        title={`Filtrovat na ${countryNames[iso3] ?? iso3}`}
                        className="rounded-full border border-[var(--color-line)] px-2 py-0.5 text-[10.5px] text-[var(--color-ink-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                      >
                        {countryNames[iso3] ?? iso3}
                      </button>
                    ))}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => remove(item.slug)}
                disabled={busy}
                className="shrink-0 rounded-full border border-[var(--color-line)] px-3 py-1 text-[12px] text-[var(--color-ink-muted)] transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
              >
                Smazat
              </button>
            </li>
          ))}
        </ul>

        {!filtered.length ? (
          <p className="mt-4 text-[13px] text-[var(--color-ink-muted)]">
            {newsItems.length
              ? "Filtrům neodpovídá žádná novinka."
              : "Zatím žádné novinky."}
          </p>
        ) : null}
      </section>
    </>
  );
}
