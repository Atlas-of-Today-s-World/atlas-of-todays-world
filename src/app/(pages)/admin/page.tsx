import type { Metadata } from "next";
import { REGIONS } from "@/data/regions";
import { allEntries, ENTRY_CATEGORIES } from "@/lib/content";
import { countriesOfRegion } from "@/lib/countries";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administrace hesel",
  description: "Mock administrace pro zakládání encyklopedických hesel Atlasu.",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const entries = await allEntries();

  return (
    <main>
      <h1 className="font-display text-[34px] font-bold">Administrace hesel</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
        Založ nové encyklopedické heslo. Uloží se jako Markdown do obsahu Atlasu
        a hned se objeví v mapě, v Hot News i ve vyhledávání.
      </p>

      <div className="mt-8">
        <AdminClient
          categories={[...ENTRY_CATEGORIES]}
          regions={REGIONS.map((region) => ({
            slug: region.slug,
            name: region.name,
            countries: countriesOfRegion(region).map((country) => ({
              iso3: country.iso3,
              name: country.name,
            })),
          }))}
          entries={entries.map((entry) => ({
            slug: entry.slug,
            title: entry.title,
            category: entry.category,
            region: entry.region,
            published: entry.published ?? null,
          }))}
        />
      </div>
    </main>
  );
}
