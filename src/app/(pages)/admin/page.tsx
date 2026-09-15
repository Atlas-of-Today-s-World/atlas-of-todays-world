import type { Metadata } from "next";
import { REGIONS } from "@/data/regions";
import { allNews, NEWS_CATEGORIES } from "@/lib/content";
import { countriesOfRegion, indexableCountries } from "@/lib/countries";
import { allSpecialRegions } from "@/lib/special-regions";
import AdminClient from "./AdminClient";
import SpecialRegionsAdmin from "./SpecialRegionsAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administrace",
  description: "Mock administrace novinek a vlastních regionů Atlasu.",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const [newsItems, specials] = await Promise.all([
    allNews(),
    allSpecialRegions(),
  ]);

  return (
    <main>
      <h1 className="font-display text-[34px] font-bold">Administrace</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
        Novinky a vlastní regiony Atlasu. Změny se projeví hned v mapě, v Hot
        News i ve vyhledávání.
      </p>

      <nav className="mt-8 flex gap-5 border-b border-[var(--color-line)] pb-3 text-[14px]">
        <a
          href="#special"
          className="font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]"
        >
          Vlastní regiony ({specials.length})
        </a>
        <a
          href="#news"
          className="font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]"
        >
          Novinky ({newsItems.length})
        </a>
      </nav>

      <section id="special" className="scroll-mt-6">
        <SpecialRegionsAdmin
          regions={specials.map((region) => ({
            slug: region.slug,
            name: region.name,
            subtitle: region.subtitle,
            summary: region.summary,
            fill: region.fill,
            stroke: region.stroke,
            countries: region.countries,
          }))}
          atlasRegions={REGIONS.map((region) => ({
            slug: region.slug,
            name: region.name,
          }))}
          countries={indexableCountries().map((country) => ({
            iso3: country.iso3,
            name: country.name,
            region: country.region?.slug ?? "",
            lon: country.labelLon,
            lat: country.labelLat,
          }))}
        />
      </section>

      <section
        id="news"
        className="mt-14 scroll-mt-6 border-t border-[var(--color-line)] pt-10"
      >
        <h2 className="font-display text-[24px] font-bold">Novinky</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
          Novinka se uloží jako Markdown do obsahu Atlasu a hned se objeví
          v mapě.
        </p>

        <AdminClient
          categories={[...NEWS_CATEGORIES]}
          regions={REGIONS.map((region) => ({
            slug: region.slug,
            name: region.name,
            countries: countriesOfRegion(region).map((country) => ({
              iso3: country.iso3,
              name: country.name,
            })),
          }))}
          newsItems={newsItems.map((item) => ({
            slug: item.slug,
            title: item.title,
            category: item.category,
            region: item.region,
            published: item.published ?? null,
          }))}
        />
      </section>
    </main>
  );
}
