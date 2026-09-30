"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MetricCard } from "@/lib/content-types";

/**
 * Nastavení jedné země nebo jednoho regionu.
 *
 * Čísla, která umí spočítat stroj (HDI, režim, korupce, chudoba…), se sem
 * nepíšou – přicházejí z Our World in Data a redakce u nich jen vybere, která
 * se u země ukážou. Ručně se zadává to, co v OWID není: etnické skupiny,
 * vysídlení, míra svobody, dětská chudoba. Tvar karty je převzatý ze
 * stávajícího webu: velká hodnota, název, věta a pod tím zdroj s rokem.
 */
export interface AdminCountryOption {
  slug: string;
  name: string;
  regionSlug: string | null;
  regionName: string | null;
  hasProfile: boolean;
}

export interface AdminCountryProfile {
  summary: string;
  tagline: string;
  markdown: string;
  metrics: MetricCard[];
  featured: string[];
}

export interface AdminRegionProfile {
  intro: string;
  metrics: MetricCard[];
  /** Sekce, které tenhle formulář needituje – ať je vidět, že se nezahodí. */
  keeps: string[];
}

const FIELD =
  "w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-[14px] text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none";
const LABEL = "block text-[12px] font-medium text-[var(--color-ink-muted)]";
const MAX_METRICS = 8;

const EMPTY_METRIC: MetricCard = {
  value: "",
  label: "",
  description: "",
  source: "",
  sourceUrl: "",
  year: "",
};

export default function ProfilesAdmin({
  scope,
  countries,
  regions,
  countryProfiles,
  regionProfiles,
  indicators,
}: {
  scope: "country" | "region";
  countries: AdminCountryOption[];
  regions: { slug: string; name: string }[];
  countryProfiles: Record<string, AdminCountryProfile>;
  regionProfiles: Record<string, AdminRegionProfile>;
  indicators: { id: string; label: string }[];
}) {
  const router = useRouter();

  const [regionFilter, setRegionFilter] = useState("");
  const [query, setQuery] = useState("");
  const [slug, setSlug] = useState(
    scope === "country" ? (countries[0]?.slug ?? "") : (regions[0]?.slug ?? ""),
  );

  const [summary, setSummary] = useState("");
  const [tagline, setTagline] = useState("");
  const [intro, setIntro] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [featured, setFeatured] = useState<string[]>([]);
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Seznam zemí je dlouhý, takže se filtruje regionem i psaním.
  const visibleCountries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return countries.filter(
      (country) =>
        (!regionFilter || country.regionSlug === regionFilter) &&
        (!needle || country.name.toLowerCase().includes(needle)),
    );
  }, [countries, regionFilter, query]);

  /**
   * Přepnutí na jiný záznam natáhne jeho uložené hodnoty. Děláme to při
   * vykreslení, ne v efektu – jinak formulář na jeden snímek ukáže data
   * předchozí země.
   */
  if (loadedSlug !== slug) {
    const country = countryProfiles[slug];
    const region = regionProfiles[slug];
    setSummary(country?.summary ?? "");
    setTagline(country?.tagline ?? "");
    setMarkdown(country?.markdown ?? "");
    setIntro(region?.intro ?? "");
    setFeatured(country?.featured ?? []);
    setMetrics(
      scope === "country" ? (country?.metrics ?? []) : (region?.metrics ?? []),
    );
    setLoadedSlug(slug);
    setError(null);
    setDone(null);
  }

  function updateMetric(index: number, patch: Partial<MetricCard>) {
    setMetrics((current) =>
      current.map((metric, i) => (i === index ? { ...metric, ...patch } : metric)),
    );
  }

  async function save() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/admin/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          scope === "country"
            ? { kind: "country", slug, summary, tagline, markdown, metrics, featured }
            : { kind: "region", slug, intro, metrics },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Uložení selhalo.");
      setDone(data.url);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Uložení selhalo.");
    } finally {
      setBusy(false);
    }
  }

  async function removeProfile() {
    const country = countries.find((item) => item.slug === slug);
    if (!country) return;
    if (
      !confirm(
        `Smazat redakční profil země ${country.name}? Importovaná data zůstanou, zmizí jen text a ruční ukazatele.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/profiles?slug=${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Smazání selhalo.");
      setLoadedSlug(null);
      setDone(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Smazání selhalo.");
    } finally {
      setBusy(false);
    }
  }

  const current = countries.find((item) => item.slug === slug);
  const regionProfile = regionProfiles[slug];

  return (
    <div className="grid gap-8 lg:grid-cols-[19rem_1fr]">
      {/* Výběr záznamu */}
      <aside>
        {scope === "country" ? (
          <>
            <label className={LABEL} htmlFor="profile-region">
              Region
            </label>
            <select
              id="profile-region"
              value={regionFilter}
              onChange={(event) => setRegionFilter(event.target.value)}
              className={`mt-1.5 ${FIELD}`}
            >
              <option value="">Všechny regiony</option>
              {regions.map((region) => (
                <option key={region.slug} value={region.slug}>
                  {region.name}
                </option>
              ))}
            </select>

            <label className={`${LABEL} mt-4`} htmlFor="profile-search">
              Hledat zemi
            </label>
            <input
              id="profile-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ukraine"
              className={`mt-1.5 ${FIELD}`}
            />

            <p className="mt-3 text-[11.5px] text-[var(--color-ink-muted)]">
              {visibleCountries.length} zemí · tučně ty, které už mají profil
            </p>

            <ul className="panel-scroll mt-2 max-h-[26rem] divide-y divide-[var(--color-line)] overflow-y-auto rounded-lg border border-[var(--color-line)]">
              {visibleCountries.map((country) => (
                <li key={country.slug}>
                  <button
                    type="button"
                    onClick={() => setSlug(country.slug)}
                    aria-current={country.slug === slug}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition ${
                      country.slug === slug
                        ? "bg-[var(--color-accent)] text-white"
                        : "hover:bg-[var(--color-line)]/40"
                    }`}
                  >
                    <span className={country.hasProfile ? "font-semibold" : ""}>
                      {country.name}
                    </span>
                    <span
                      className={`text-[10.5px] ${
                        country.slug === slug
                          ? "text-white/70"
                          : "text-[var(--color-ink-muted)]"
                      }`}
                    >
                      {country.regionName ?? "—"}
                    </span>
                  </button>
                </li>
              ))}
              {!visibleCountries.length ? (
                <li className="px-3 py-3 text-[12.5px] text-[var(--color-ink-muted)]">
                  Nic nenalezeno.
                </li>
              ) : null}
            </ul>
          </>
        ) : (
          <ul className="divide-y divide-[var(--color-line)] rounded-lg border border-[var(--color-line)]">
            {regions.map((region) => {
              const profile = regionProfiles[region.slug];
              const count = profile?.metrics.length ?? 0;
              return (
                <li key={region.slug}>
                  <button
                    type="button"
                    onClick={() => setSlug(region.slug)}
                    aria-current={region.slug === slug}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[13px] transition ${
                      region.slug === slug
                        ? "bg-[var(--color-accent)] text-white"
                        : "hover:bg-[var(--color-line)]/40"
                    }`}
                  >
                    <span>{region.name}</span>
                    <span
                      className={`text-[10.5px] ${
                        region.slug === slug
                          ? "text-white/70"
                          : "text-[var(--color-ink-muted)]"
                      }`}
                    >
                      {count ? `${count} ukazatelů` : "bez ukazatelů"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {/* Formulář */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-[20px] font-bold">
            {scope === "country"
              ? (current?.name ?? "Vyber zemi")
              : (regions.find((item) => item.slug === slug)?.name ?? "Vyber region")}
          </h3>
          <Link
            href={scope === "country" ? `/country/${slug}` : `/region/${slug}`}
            className="text-[12.5px] text-[var(--color-link)] hover:underline"
          >
            Otevřít v mapě →
          </Link>
        </div>

        {scope === "country" ? (
          <>
            <div className="mt-5">
              <label className={LABEL} htmlFor="profile-summary">
                Shrnutí pod název země
              </label>
              <textarea
                id="profile-summary"
                rows={3}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                className={`mt-1.5 ${FIELD}`}
                placeholder="Jedna až dvě věty. Když zůstane prázdné, složí se věta z importovaných dat."
              />
            </div>

            <div className="mt-4">
              <label className={LABEL} htmlFor="profile-tagline">
                Podtitulek <span className="font-normal">(nepovinný)</span>
              </label>
              <input
                id="profile-tagline"
                value={tagline}
                onChange={(event) => setTagline(event.target.value)}
                className={`mt-1.5 ${FIELD}`}
                placeholder="Showing the whole environment of the country — the society, government, living conditions, and daily life"
              />
            </div>

            <fieldset className="mt-6">
              <legend className={LABEL}>
                Automatické ukazatele, které se u země ukážou
              </legend>
              <p className="mt-1 text-[11.5px] text-[var(--color-ink-muted)]">
                Data z Our World in Data, obnovují se příkazem{" "}
                <code>npm run data:indicators</code>. Nic nevybráno = prvních šest.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {indicators.map((indicator) => {
                  const on = featured.includes(indicator.id);
                  return (
                    <button
                      type="button"
                      key={indicator.id}
                      aria-pressed={on}
                      onClick={() =>
                        setFeatured((current) =>
                          on
                            ? current.filter((id) => id !== indicator.id)
                            : [...current, indicator.id],
                        )
                      }
                      className={`rounded-full border px-2.5 py-1 text-[12px] transition ${
                        on
                          ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                          : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-accent)]"
                      }`}
                    >
                      {indicator.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </>
        ) : (
          <div className="mt-5">
            <label className={LABEL} htmlFor="profile-intro">
              Úvodní odstavec o socio-politické situaci regionu
            </label>
            <textarea
              id="profile-intro"
              rows={6}
              value={intro}
              onChange={(event) => setIntro(event.target.value)}
              className={`mt-1.5 ${FIELD}`}
              placeholder="Text, kterým portrét regionu začíná. Když zůstane prázdný, použije se shrnutí z dat Atlasu."
            />
            {regionProfile?.keeps.length ? (
              <p className="mt-2 text-[11.5px] text-[var(--color-ink-muted)]">
                Beze změny zůstane: {regionProfile.keeps.join(", ")}.
              </p>
            ) : null}
          </div>
        )}

        <MetricEditor
          metrics={metrics}
          onChange={updateMetric}
          onAdd={() => setMetrics((current) => [...current, { ...EMPTY_METRIC }])}
          onRemove={(index) =>
            setMetrics((current) => current.filter((_, i) => i !== index))
          }
          onMove={(index, delta) =>
            setMetrics((current) => {
              const next = [...current];
              const target = index + delta;
              if (target < 0 || target >= next.length) return current;
              [next[index], next[target]] = [next[target], next[index]];
              return next;
            })
          }
        />

        {scope === "country" ? (
          <div className="mt-6">
            <label className={LABEL} htmlFor="profile-markdown">
              Delší text k zemi (Markdown){" "}
              <span className="font-normal">(nepovinný)</span>
            </label>
            <textarea
              id="profile-markdown"
              rows={10}
              value={markdown}
              onChange={(event) => setMarkdown(event.target.value)}
              className={`mt-1.5 font-mono text-[13px] ${FIELD}`}
              placeholder={"Odstavec o současné situaci země.\n\n## Mezinadpis\n\nDalší text."}
            />
          </div>
        ) : null}

        {error ? (
          <p className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {error}
          </p>
        ) : null}
        {done ? (
          <p className="mt-5 rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
            Uloženo.{" "}
            <Link href={done} className="font-medium underline">
              Otevřít v mapě
            </Link>
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={busy || !slug}
            className="rounded-full bg-[var(--color-accent)] px-6 py-2.5 text-[14px] font-medium text-white transition hover:bg-[var(--color-accent-strong)] disabled:opacity-50"
          >
            {busy ? "Ukládám…" : "Uložit nastavení"}
          </button>
          {scope === "country" && current?.hasProfile ? (
            <button
              type="button"
              onClick={removeProfile}
              disabled={busy}
              className="rounded-full border border-[var(--color-line)] px-4 py-2 text-[13px] text-[var(--color-ink-muted)] transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
            >
              Smazat profil země
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/**
 * Řádky ručních ukazatelů plus náhled karty, jak bude vypadat na webu –
 * redaktor tak hned vidí, že „17.8M" je v pořádku a „17 800 000 lidí" se
 * do karty nevejde.
 */
function MetricEditor({
  metrics,
  onChange,
  onAdd,
  onRemove,
  onMove,
}: {
  metrics: MetricCard[];
  onChange: (index: number, patch: Partial<MetricCard>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (index: number, delta: number) => void;
}) {
  return (
    <section className="mt-8 rounded-xl border border-[var(--color-line)] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-display text-[16px] font-bold">
          Ruční ukazatele{" "}
          <span className="text-[var(--color-ink-muted)]">
            ({metrics.length}/{MAX_METRICS})
          </span>
        </h4>
        <p className="text-[11.5px] text-[var(--color-ink-muted)]">
          Čísla, která nejsou v Our World in Data. Bez zdroje se karta
          nepublikuje.
        </p>
      </div>

      <div className="mt-4 space-y-4">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className="rounded-lg border border-[var(--color-line)] bg-[var(--color-line)]/10 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-ink-muted)]">
                Ukazatel {index + 1}
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  aria-label="Posunout nahoru"
                  onClick={() => onMove(index, -1)}
                  disabled={index === 0}
                  className="grid h-7 w-7 place-items-center rounded border border-[var(--color-line)] bg-white text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)] disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Posunout dolů"
                  onClick={() => onMove(index, 1)}
                  disabled={index === metrics.length - 1}
                  className="grid h-7 w-7 place-items-center rounded border border-[var(--color-line)] bg-white text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)] disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="rounded border border-[var(--color-line)] bg-white px-2 text-[12px] text-[var(--color-ink-muted)] transition hover:border-red-300 hover:text-red-600"
                >
                  Odebrat
                </button>
              </span>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-[7rem_1fr]">
              <div>
                <label className={LABEL} htmlFor={`metric-value-${index}`}>
                  Hodnota
                </label>
                <input
                  id={`metric-value-${index}`}
                  value={metric.value}
                  onChange={(event) => onChange(index, { value: event.target.value })}
                  className={`mt-1.5 ${FIELD}`}
                  placeholder="24.4 %"
                />
              </div>
              <div>
                <label className={LABEL} htmlFor={`metric-label-${index}`}>
                  Název
                </label>
                <input
                  id={`metric-label-${index}`}
                  value={metric.label}
                  onChange={(event) => onChange(index, { label: event.target.value })}
                  className={`mt-1.5 ${FIELD}`}
                  placeholder="Youth Unemployment"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className={LABEL} htmlFor={`metric-desc-${index}`}>
                Vysvětlení <span className="font-normal">(věta)</span>
              </label>
              <textarea
                id={`metric-desc-${index}`}
                rows={2}
                value={metric.description ?? ""}
                onChange={(event) =>
                  onChange(index, { description: event.target.value })
                }
                className={`mt-1.5 ${FIELD}`}
                placeholder="Amount of unemployment in the region for the over 60 % of the population who are under 30."
              />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_6rem]">
              <div>
                <label className={LABEL} htmlFor={`metric-source-${index}`}>
                  Zdroj
                </label>
                <input
                  id={`metric-source-${index}`}
                  value={metric.source}
                  onChange={(event) => onChange(index, { source: event.target.value })}
                  className={`mt-1.5 ${FIELD}`}
                  placeholder="UNHCR"
                />
              </div>
              <div>
                <label className={LABEL} htmlFor={`metric-url-${index}`}>
                  Odkaz na zdroj
                </label>
                <input
                  id={`metric-url-${index}`}
                  type="url"
                  value={metric.sourceUrl ?? ""}
                  onChange={(event) =>
                    onChange(index, { sourceUrl: event.target.value })
                  }
                  className={`mt-1.5 ${FIELD}`}
                  placeholder="https://www.unhcr.org/…"
                />
              </div>
              <div>
                <label className={LABEL} htmlFor={`metric-year-${index}`}>
                  Rok
                </label>
                <input
                  id={`metric-year-${index}`}
                  value={metric.year ?? ""}
                  onChange={(event) => onChange(index, { year: event.target.value })}
                  className={`mt-1.5 ${FIELD}`}
                  placeholder="2025"
                />
              </div>
            </div>

            {metric.value || metric.label ? (
              <div className="mt-4 rounded-lg border border-dashed border-[var(--color-line)] bg-white p-3">
                <span className="text-[10.5px] uppercase tracking-[0.1em] text-[var(--color-ink-muted)]">
                  Náhled karty
                </span>
                <p className="mt-1.5 font-display text-[22px] font-semibold leading-none text-[var(--color-ink)]">
                  {metric.value || "—"}
                </p>
                <p className="mt-1.5 text-[13px] font-medium text-[var(--color-ink)]">
                  {metric.label || "Bez názvu"}
                </p>
                {metric.description ? (
                  <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-ink-muted)]">
                    {metric.description}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                  {metric.source ? `Source: ${metric.source}` : "Chybí zdroj"}
                  {metric.year ? `, ${metric.year}` : ""}
                </p>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {metrics.length < MAX_METRICS ? (
        <button
          type="button"
          onClick={onAdd}
          className="mt-4 rounded-full border border-[var(--color-line)] px-4 py-2 text-[13px] text-[var(--color-ink-soft)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        >
          + Přidat ukazatel
        </button>
      ) : (
        <p className="mt-4 text-[12px] text-[var(--color-ink-muted)]">
          Víc než {MAX_METRICS} ukazatelů se do portrétu nevejde.
        </p>
      )}
    </section>
  );
}
