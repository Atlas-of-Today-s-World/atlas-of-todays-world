"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export interface AdminCountry {
  iso3: string;
  name: string;
  region: string;
  lon: number | null;
  lat: number | null;
}

export interface AdminGlobalIssue {
  slug: string;
  name: string;
  subtitle: string;
  summary: string;
  fill: string;
  stroke: string;
  countries: string[];
}

const FIELD =
  "w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-[14px] text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none";
const LABEL = "block text-[12px] font-medium text-[var(--color-ink-muted)]";

/** Nabídka barev v pastelové rodině Figmy, ať global issues nevypadají cizí. */
const PALETTE = [
  { fill: "#A8C8E8", stroke: "#3E7AA8" },
  { fill: "#C9E0A8", stroke: "#5C8C36" },
  { fill: "#F4C89A", stroke: "#B06A22" },
  { fill: "#E0A8C0", stroke: "#A03E6B" },
  { fill: "#E8CE8A", stroke: "#A8842A" },
  { fill: "#B6A8E0", stroke: "#5C46A8" },
  { fill: "#8FD6C4", stroke: "#217F68" },
  { fill: "#F2A9A0", stroke: "#B04236" },
];

const EMPTY = {
  slug: "",
  name: "",
  subtitle: "",
  summary: "",
  fill: PALETTE[0].fill,
  stroke: PALETTE[0].stroke,
  countries: [] as string[],
};

/**
 * Skládání global issues ze zemí. Můžou libovolně křížit hranice regionů
 * Atlasu – právě proto tu jsou.
 */
export default function GlobalIssuesAdmin({
  regions,
  countries,
  atlasRegions,
}: {
  regions: AdminGlobalIssue[];
  countries: AdminCountry[];
  atlasRegions: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(EMPTY);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const editing = regions.some((region) => region.slug === draft.slug);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return countries;
    return countries.filter(
      (country) =>
        country.name.toLowerCase().includes(needle) ||
        country.region.toLowerCase().includes(needle),
    );
  }, [countries, filter]);

  function toggle(iso3: string) {
    setDraft((current) => ({
      ...current,
      countries: current.countries.includes(iso3)
        ? current.countries.filter((item) => item !== iso3)
        : [...current.countries, iso3],
    }));
  }

  function addAtlasRegion(slug: string) {
    if (!slug) return;
    const members = countries
      .filter((country) => country.region === slug)
      .map((country) => country.iso3);
    setDraft((current) => ({
      ...current,
      countries: [...new Set([...current.countries, ...members])],
    }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);

    const points = draft.countries.map((iso3) => {
      const country = countries.find((item) => item.iso3 === iso3);
      return { lon: country?.lon ?? null, lat: country?.lat ?? null };
    });

    try {
      const res = await fetch("/api/admin/global-issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, points }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Uložení selhalo.");
      setDone(data.url);
      setDraft(EMPTY);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Uložení selhalo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(slug: string) {
    if (!confirm(`Smazat celek „${slug}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/global-issues?slug=${encodeURIComponent(slug)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Smazání selhalo.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Smazání selhalo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[1.35fr_1fr]">
      <section>
        <h2 className="font-display text-[20px] font-bold">
          {editing ? `Úprava celku „${draft.name}"` : "Nový global issue"}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
          Global Issues se na globusu zapínají přepínačem{" "}
          <strong className="font-medium">Global Issues</strong>. Nemusí
          respektovat hranice devíti regionů Atlasu.
        </p>

        <form onSubmit={save} className="mt-5 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="sr-name">Název</label>
              <input
                id="sr-name"
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className={`mt-1.5 ${FIELD}`}
                placeholder="Demo region 11"
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="sr-subtitle">Podtitul</label>
              <input
                id="sr-subtitle"
                value={draft.subtitle}
                onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                className={`mt-1.5 ${FIELD}`}
                placeholder="Čím je celek vymezený"
              />
            </div>
          </div>

          <div>
            <label className={LABEL} htmlFor="sr-summary">Popis</label>
            <textarea
              id="sr-summary"
              rows={3}
              value={draft.summary}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
              className={`mt-1.5 ${FIELD}`}
              placeholder="Proč tyhle země patří k sobě."
            />
          </div>

          <div>
            <span className={LABEL}>Barva na globusu</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {PALETTE.map((color) => (
                <button
                  key={color.fill}
                  type="button"
                  aria-label={`Barva ${color.fill}`}
                  aria-pressed={draft.fill === color.fill}
                  onClick={() => setDraft({ ...draft, ...color })}
                  style={{ background: color.fill, borderColor: color.stroke }}
                  className={`h-8 w-8 rounded-full border-2 transition ${
                    draft.fill === color.fill
                      ? "ring-2 ring-[var(--color-accent)] ring-offset-2"
                      : ""
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <span className={LABEL}>
                Země v celku{" "}
                <span className="font-normal">({draft.countries.length} vybráno)</span>
              </span>
              <select
                aria-label="Přidat celý region Atlasu"
                defaultValue=""
                onChange={(e) => { addAtlasRegion(e.target.value); e.target.value = ""; }}
                className="rounded-lg border border-[var(--color-line)] px-2 py-1 text-[12px] text-[var(--color-ink-soft)]"
              >
                <option value="">+ přidat celý region Atlasu</option>
                {atlasRegions.map((region) => (
                  <option key={region.slug} value={region.slug}>{region.name}</option>
                ))}
              </select>
            </div>

            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Hledat zemi…"
              className={`mt-2 ${FIELD}`}
            />

            <div className="mt-2 flex max-h-64 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-[var(--color-line)] p-2.5">
              {visible.map((country) => {
                const on = draft.countries.includes(country.iso3);
                return (
                  <button
                    type="button"
                    key={country.iso3}
                    onClick={() => toggle(country.iso3)}
                    aria-pressed={on}
                    className={`rounded-full border px-2.5 py-1 text-[12px] transition ${
                      on
                        ? "border-transparent text-white"
                        : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-accent)]"
                    }`}
                    style={on ? { background: draft.stroke } : undefined}
                  >
                    {country.name}
                  </button>
                );
              })}
            </div>
          </div>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
          ) : null}
          {done ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
              Uloženo.{" "}
              <Link href={done} className="font-medium underline">Otevřít v mapě</Link>
            </p>
          ) : null}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-[var(--color-accent)] px-6 py-2.5 text-[14px] font-medium text-white transition hover:bg-[var(--color-accent-strong)] disabled:opacity-50"
            >
              {busy ? "Ukládám…" : editing ? "Uložit změny" : "Vytvořit celek"}
            </button>
            {draft.name || draft.countries.length ? (
              <button
                type="button"
                onClick={() => setDraft(EMPTY)}
                className="rounded-full border border-[var(--color-line)] px-5 py-2.5 text-[14px] text-[var(--color-ink-soft)]"
              >
                Vyprázdnit
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section>
        <h2 className="font-display text-[20px] font-bold">
          Global Issues{" "}
          <span className="text-[var(--color-ink-muted)]">({regions.length})</span>
        </h2>

        <ul className="mt-5 grid gap-2">
          {regions.map((region) => (
            <li
              key={region.slug}
              className="flex items-start gap-3 rounded-xl border border-[var(--color-line)] p-3"
            >
              <span
                className="mt-1 h-4 w-4 shrink-0 rounded-full border-2"
                style={{ background: region.fill, borderColor: region.stroke }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/global-issue/${region.slug}`}
                  className="block text-[14px] font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                >
                  {region.name}
                </Link>
                <p className="mt-0.5 text-[11.5px] text-[var(--color-ink-muted)]">
                  {region.subtitle} · {region.countries.length} zemí
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => setDraft({ ...region })}
                  className="rounded-full border border-[var(--color-line)] px-3 py-1 text-[12px] text-[var(--color-ink-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                >
                  Upravit
                </button>
                <button
                  type="button"
                  onClick={() => remove(region.slug)}
                  disabled={busy}
                  className="rounded-full border border-[var(--color-line)] px-3 py-1 text-[12px] text-[var(--color-ink-muted)] transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                >
                  Smazat
                </button>
              </div>
            </li>
          ))}
        </ul>

        {!regions.length ? (
          <p className="mt-4 text-[13px] text-[var(--color-ink-muted)]">
            Zatím žádné global issues.
          </p>
        ) : null}
      </section>
    </div>
  );
}
