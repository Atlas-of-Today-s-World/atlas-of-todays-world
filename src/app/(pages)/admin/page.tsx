import type { Metadata } from "next";
import { REGIONS } from "@/data/regions";
import { allNews, NEWS_CATEGORIES } from "@/lib/content";
import { countriesOfRegion } from "@/lib/countries";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administrace novinek",
  description: "Mock administrace pro zakládání novinek Atlasu.",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const newsItems = await allNews();

  return (
    <main>
      <h1 className="font-display text-[34px] font-bold">Administrace novinek</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
        Založ novou novinku. Uloží se jako Markdown do obsahu Atlasu
        a hned se objeví v mapě, v Hot News i ve vyhledávání.
      </p>

      <div className="mt-8">
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
      </div>
    </main>
  );
}
