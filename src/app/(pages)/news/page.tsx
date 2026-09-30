import type { Metadata } from "next";
import Link from "next/link";
import { getEntries } from "@/features/entries/queries";
import { getAtlas } from "@/features/geography/queries";
import { NEWS_CATEGORIES } from "@/lib/content-types";

export const metadata: Metadata = {
  title: "All news",
  description: "Every published item of Atlas of Today's World, by region and by theme.",
  alternates: { canonical: "/news" },
};

export default async function NewsIndexPage() {
  const [newsItems, atlas] = await Promise.all([getEntries(), getAtlas()]);

  return (
    <main>
      <h1 className="font-display text-[34px] font-bold">News</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
        Each news item opens inside the world map, so you never lose the geographic context.{" "}
        {newsItems.length} published so far.
      </p>

      {NEWS_CATEGORIES.map((category) => {
        const group = newsItems.filter((item) => item.category === category);
        if (!group.length) return null;
        return (
          <section key={category} className="mt-10">
            <h2 className="font-display text-[18px] font-bold">{category}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {group.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/news/${item.slug}`}
                    className="group block h-full rounded-xl border border-[var(--color-line)] p-4 transition hover:border-[var(--color-accent)]"
                  >
                    <span className="text-[11px] tracking-wide text-[var(--color-ink-muted)] uppercase">
                      {item.region ? atlas.regionBySlug.get(item.region)?.name : null}
                      {item.issue ? (
                        <>
                          {" · "}
                          <span className="text-[var(--color-link)]">
                            {atlas.issueBySlug.get(item.issue)?.name ?? item.issue}
                          </span>
                        </>
                      ) : null}
                    </span>
                    <span className="font-display mt-1 block text-[15px] font-bold group-hover:text-[var(--color-accent)]">
                      {item.title}
                    </span>
                    <span className="mt-1.5 block text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
                      {item.summary}
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
          {atlas.regions.map((region) => (
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
