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

  const specialName = new Map(specials.map((item) => [item.slug, item.name]));
  // Jména zemí pro celky – ty sahají napříč regiony, takže si je výběr zemí
  // v administraci nedokáže odvodit z jednoho regionu Atlasu.
  const countryName = new Map(
    indexableCountries().map((country) => [country.iso3, country.name]),
  );

  return (
    <main>
      <h1 className="font-display text-[34px] font-bold">Administrace</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
        Novinky a vlastní regiony Atlasu. Změny se projeví hned v mapě, v Hot
        News i ve vyhledávání.
      </p>

      <nav className="mt-8 flex gap-5 border-b border-[var(--color-line)] pb-3 text-[14px]">
        <a
          href="#news"
          className="font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]"
        >
          Novinky ({newsItems.length})
        </a>
        <a
          href="#special"
          className="font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]"
        >
          Vlastní regiony ({specials.length})
        </a>
      </nav>

      <section id="news" className="mt-10 scroll-mt-6">
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
          specials={specials.map((region) => ({
            slug: region.slug,
            name: region.name,
            countries: region.countries.map((iso3) => ({
              iso3,
              name: countryName.get(iso3) ?? iso3,
            })),
          }))}
          newsItems={newsItems.map((item) => ({
            slug: item.slug,
            title: item.title,
            category: item.category,
            region: item.region,
            special: item.special ?? null,
            specialName: item.special
              ? specialName.get(item.special) ?? item.special
              : null,
            published: item.published ?? null,
          }))}
        />
      </section>

      <section
        id="special"
        className="mt-14 scroll-mt-6 border-t border-[var(--color-line)] pt-10"
      >
        <h2 className="font-display text-[24px] font-bold">Vlastní regiony</h2>

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
    </main>
  );
}
