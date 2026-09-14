"use client";

import { useState } from "react";
import Link from "next/link";
import { ENTRY_CATEGORIES, type EntryCategory } from "@/lib/content-types";

export interface EntryCard {
  slug: string;
  title: string;
  summary: string;
  category: EntryCategory;
  hero?: string;
}

/** Sekce "Our Entries" – tmavý pruh se záložkami kategorií a řadou karet. */
export default function EntryTabs({ entries }: { entries: EntryCard[] }) {
  const available = ENTRY_CATEGORIES.filter((category) =>
    entries.some((entry) => entry.category === category),
  );
  const [active, setActive] = useState<EntryCategory | null>(available[0] ?? null);

  const visible = active
    ? entries.filter((entry) => entry.category === active)
    : entries;

  return (
    <section className="bg-[var(--color-band)] px-6 py-9 text-white sm:px-8">
      <h2 className="font-display text-[24px] font-bold">Our Entries</h2>

      {available.length ? (
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
          {available.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActive(category)}
              className={`transition ${
                active === category
                  ? "font-semibold text-[#7f97ff]"
                  : "text-white/65 hover:text-white"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      ) : null}

      {visible.length ? (
        <div className="panel-scroll -mx-1 mt-5 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
          {visible.map((entry) => (
            <Link
              key={entry.slug}
              href={`/entry/${entry.slug}`}
              className="group w-56 shrink-0 snap-start overflow-hidden rounded-xl bg-white text-[var(--color-ink)] transition hover:-translate-y-0.5"
            >
              <div
                className="h-28 w-full bg-cover bg-center"
                style={{
                  backgroundImage: `url(${entry.hero ?? "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=60"})`,
                }}
              />
              <div className="p-3">
                <h3 className="font-display text-[13.5px] font-bold leading-snug group-hover:text-[var(--color-accent)]">
                  {entry.title}
                </h3>
                <p className="mt-1 line-clamp-3 text-[11.5px] leading-snug text-[var(--color-ink-muted)]">
                  {entry.summary}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-[13px] text-white/60">
          No entries published in this region yet. Contributors welcome.
        </p>
      )}
    </section>
  );
}
