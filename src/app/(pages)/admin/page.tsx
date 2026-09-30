import type { Metadata } from "next";
import { REGIONS } from "@/data/regions";
import {
  allNews,
  countryProfile,
  countryProfileSlugs,
  regionDossier,
  NEWS_CATEGORIES,
} from "@/lib/content";
import { countriesOfRegion, indexableCountries } from "@/lib/countries";
import { allGlobalIssues } from "@/lib/global-issues";
import { INDICATORS } from "@/lib/indicators";
import AdminClient from "./AdminClient";
import AdminTabs from "./AdminTabs";
import GlobalIssuesAdmin from "./GlobalIssuesAdmin";
import ProfilesAdmin, { type AdminCountryProfile, type AdminRegionProfile } from "./ProfilesAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administrace",
  description: "Redakce novinek, profilů zemí, regionů a Global Issues Atlasu.",
  robots: { index: false, follow: false },
};

/** Sekce portrétu regionu, které formulář nastavení needituje. */
const KEPT_SECTIONS: { key: "timeline" | "visuals" | "resources" | "faq"; label: string }[] = [
  { key: "timeline", label: "časová osa" },
  { key: "visuals", label: "karusel map" },
  { key: "resources", label: "databáze zdrojů" },
  { key: "faq", label: "FAQ" },
];

export default async function AdminPage() {
  const countries = indexableCountries();
  const [newsItems, issues, profileSlugs] = await Promise.all([
    allNews(),
    allGlobalIssues(),
    countryProfileSlugs(),
  ]);

  const issueName = new Map(issues.map((item) => [item.slug, item.name]));
  // Jména zemí pro celky – ty sahají napříč regiony, takže si je výběr zemí
  // v administraci nedokáže odvodit z jednoho regionu Atlasu.
  const countryName = new Map(countries.map((country) => [country.iso3, country.name]));

  // Redakční profily existují jen u hrstky zemí, takže se načtou všechny naráz
  // a formulář pak přepíná bez dalšího dotazu na server.
  const countryProfiles: Record<string, AdminCountryProfile> = {};
  await Promise.all(
    profileSlugs.map(async (slug) => {
      const profile = await countryProfile(slug);
      if (!profile) return;
      countryProfiles[slug] = {
        summary: profile.summary ?? "",
        tagline: profile.tagline ?? "",
        markdown: profile.markdown,
        metrics: profile.metrics ?? [],
        featured: profile.featured ?? [],
      };
    }),
  );

  const regionProfiles: Record<string, AdminRegionProfile> = {};
  await Promise.all(
    REGIONS.map(async (region) => {
      const dossier = await regionDossier(region.slug);
      regionProfiles[region.slug] = {
        intro: dossier.intro ?? "",
        metrics: dossier.metrics ?? [],
        keeps: KEPT_SECTIONS.filter(({ key }) => dossier[key]?.length).map(({ label }) => label),
      };
    }),
  );

  const regionOptions = REGIONS.map((region) => ({
    slug: region.slug,
    name: region.name,
  }));

  return (
    <main>
      <h1 className="font-display text-[34px] font-bold">Administrace</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
        Novinky, nastavení jednotlivých zemí a regionů a Global Issues. Změny se projeví hned v mapě
        i ve vyhledávání.
      </p>

      <AdminTabs
        tabs={[
          {
            id: "novinky",
            label: "Novinky",
            count: newsItems.length,
            content: (
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
                issues={issues.map((issue) => ({
                  slug: issue.slug,
                  name: issue.name,
                  countries: issue.countries.map((iso3) => ({
                    iso3,
                    name: countryName.get(iso3) ?? iso3,
                  })),
                }))}
                newsItems={newsItems.map((item) => ({
                  slug: item.slug,
                  title: item.title,
                  category: item.category,
                  region: item.region,
                  regionName:
                    REGIONS.find((region) => region.slug === item.region)?.name ?? item.region,
                  issue: item.issue ?? null,
                  issueName: item.issue ? (issueName.get(item.issue) ?? item.issue) : null,
                  countries: item.countries ?? [],
                  published: item.published ?? null,
                }))}
                countryNames={Object.fromEntries(countryName)}
              />
            ),
          },
          {
            id: "zeme",
            label: "Země",
            count: profileSlugs.length,
            content: (
              <>
                <SectionIntro
                  title="Nastavení země"
                  lead="Co se u země ukáže v jejím profilu: shrnutí, které automatické ukazatele vybrat a ruční ukazatele s citací pro čísla, která Our World in Data nemá."
                />
                <ProfilesAdmin
                  scope="country"
                  countries={countries.map((country) => ({
                    slug: country.slug,
                    name: country.name,
                    regionSlug: country.region?.slug ?? null,
                    regionName: country.region?.name ?? null,
                    hasProfile: profileSlugs.includes(country.slug),
                  }))}
                  regions={regionOptions}
                  countryProfiles={countryProfiles}
                  regionProfiles={{}}
                  indicators={INDICATORS.map((indicator) => ({
                    id: indicator.id,
                    label: indicator.label,
                  }))}
                />
              </>
            ),
          },
          {
            id: "regiony",
            label: "Regiony",
            count: REGIONS.length,
            content: (
              <>
                <SectionIntro
                  title="Nastavení regionu"
                  lead="Úvodní odstavec portrétu a šest ukazatelů s citací. Časová osa, zdroje a FAQ zůstávají v souboru regionu beze změny."
                />
                <ProfilesAdmin
                  scope="region"
                  countries={[]}
                  regions={regionOptions}
                  countryProfiles={{}}
                  regionProfiles={regionProfiles}
                  indicators={[]}
                />
              </>
            ),
          },
          {
            id: "global-issues",
            label: "Global Issues",
            count: issues.length,
            content: (
              <GlobalIssuesAdmin
                regions={issues.map((issue) => ({
                  slug: issue.slug,
                  name: issue.name,
                  subtitle: issue.subtitle,
                  summary: issue.summary,
                  fill: issue.fill,
                  stroke: issue.stroke,
                  countries: issue.countries,
                }))}
                atlasRegions={regionOptions}
                countries={countries.map((country) => ({
                  iso3: country.iso3,
                  name: country.name,
                  region: country.region?.slug ?? "",
                  lon: country.labelLon,
                  lat: country.labelLat,
                }))}
              />
            ),
          },
        ]}
      />
    </main>
  );
}

function SectionIntro({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="mb-7">
      <h2 className="font-display text-[22px] font-bold">{title}</h2>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
        {lead}
      </p>
    </div>
  );
}
