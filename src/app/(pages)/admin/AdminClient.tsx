"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export interface AdminNewsItem {
  slug: string;
  title: string;
  category: string;
  region: string;
  special: string | null;
  specialName: string | null;
  published: string | null;
}

export interface AdminRegion {
  slug: string;
  name: string;
  countries: { iso3: string; name: string }[];
}

/** Vlastní celek ke zvolení u novinky. */
export interface AdminSpecial {
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
  specials,
  categories,
}: {
  newsItems: AdminNewsItem[];
  regions: AdminRegion[];
  specials: AdminSpecial[];
  categories: string[];
}) {
  const router = useRouter();
  const [regionSlug, setRegionSlug] = useState(regions[0]?.slug ?? "");
  const [specialSlug, setSpecialSlug] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const region = regions.find((item) => item.slug === regionSlug);
  const special = specials.find((item) => item.slug === specialSlug);

  // Nabídka zemí = země regionu + země zvoleného celku. Celek sahá napříč
  // regiony, takže bez toho by se jeho země nedaly u novinky zaškrtnout.
  const pickable = [
    ...(region?.countries ?? []),
    ...(special?.countries ?? []).filter(
      (item) => !(region?.countries ?? []).some((c) => c.iso3 === item.iso3),
    ),
  ];

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
          special: specialSlug,
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
      setSpecialSlug("");
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
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-900">
        <strong className="font-semibold">Mock administrace.</strong> Žádné
        přihlášení, zapisuje přímo do <code>src/content/news/</code> na disku.
        Funguje jen při lokálním běhu; před ostrým nasazením tohle nahradí
        redakční systém s účty.
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.35fr_1fr]">
        <section>
          <h2 className="font-display text-[20px] font-bold">Nová novinka</h2>

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
                placeholder="Jedna až dvě věty, které se ukážou v Hot News a ve výsledcích hledání." />
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
              <label className={LABEL} htmlFor="news-special">
                Vlastní celek{" "}
                <span className="font-normal">
                  (nepovinné – novinka se pak ukáže i v profilu celku)
                </span>
              </label>
              <select
                id="news-special"
                name="special"
                value={specialSlug}
                onChange={(event) => setSpecialSlug(event.target.value)}
                className={`mt-1.5 ${FIELD}`}
              >
                <option value="">— žádný —</option>
                {specials.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
              {special ? (
                <button
                  type="button"
                  onClick={() =>
                    setCountries((current) => [
                      ...current,
                      ...special.countries
                        .map((item) => item.iso3)
                        .filter((iso3) => !current.includes(iso3)),
                    ])
                  }
                  className="mt-2 rounded-full border border-[var(--color-line)] px-3 py-1 text-[12px] text-[var(--color-ink-soft)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                >
                  + označit všech {special.countries.length} zemí celku
                </button>
              ) : null}
            </div>

            <div>
              <span className={LABEL}>
                Země, kterých se novinka týká{" "}
                <span className="font-normal">
                  (jedna země = štítek země v Hot News, víc = štítek regionu)
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

        <section>
          <h2 className="font-display text-[20px] font-bold">
            Publikované novinky <span className="text-[var(--color-ink-muted)]">({newsItems.length})</span>
          </h2>

          <ul className="mt-5 divide-y divide-[var(--color-line)]">
            {newsItems.map((item) => (
              <li key={item.slug} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/news/${item.slug}`}
                    className="block text-[14px] font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                  >
                    {item.title}
                  </Link>
                  <p className="mt-0.5 text-[11.5px] text-[var(--color-ink-muted)]">
                    {item.category} · {item.region}
                    {item.specialName ? ` · ${item.specialName}` : ""}
                    {item.published ? ` · ${item.published}` : ""}
                  </p>
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

          {!newsItems.length ? (
            <p className="mt-4 text-[13px] text-[var(--color-ink-muted)]">
              Zatím žádné novinky.
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}
