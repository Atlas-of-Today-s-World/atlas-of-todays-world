import type { Metadata } from "next";
import Link from "next/link";
import { allEntries, ENTRY_CATEGORIES } from "@/lib/content";
import { REGIONS } from "@/data/regions";

export const metadata: Metadata = {
  title: "All encyclopedia entries",
  description:
    "Every published entry of Atlas of Today's World, by region and by theme.",
  alternates: { canonical: "/entries" },
};

export default async function EntriesPage() {
  const entries = await allEntries();

  return (
    <main>
      <h1 className="font-display text-[34px] font-bold">Encyclopedia entries</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
        Each entry opens inside the world map, so you never lose the geographic
        context. {entries.length} published so far.
      </p>

      {ENTRY_CATEGORIES.map((category) => {
        const group = entries.filter((entry) => entry.category === category);
        if (!group.length) return null;
        return (
          <section key={category} className="mt-10">
            <h2 className="font-display text-[18px] font-bold">{category}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {group.map((entry) => (
                <li key={entry.slug}>
                  <Link
                    href={`/entry/${entry.slug}`}
                    className="group block h-full rounded-xl border border-[var(--color-line)] p-4 transition hover:border-[var(--color-accent)]"
                  >
                    <span className="text-[11px] uppercase tracking-wide text-[var(--color-ink-muted)]">
                      {entry.regionRef?.name}
                    </span>
                    <span className="mt-1 block font-display text-[15px] font-bold group-hover:text-[var(--color-accent)]">
                      {entry.title}
                    </span>
                    <span className="mt-1.5 block text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
                      {entry.summary}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className="mt-12 border-t border-[var(--color-line)] pt-8">
        <h2 className="font-display text-[18px] font-bold">Browse by region</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {REGIONS.map((region) => (
            <Link
              key={region.slug}
              href={`/region/${region.slug}`}
              className="rounded-full border border-[var(--color-line)] px-3.5 py-1.5 text-[13px] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              {region.name}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
