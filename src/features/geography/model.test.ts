import { describe, expect, it } from "vitest";
import { buildAtlas, countriesOf, regionColorMap, type AtlasSnapshot } from "./model";

const country = (iso3: string, region: string | null, population: number) => ({
  iso3,
  slug: iso3.toLowerCase(),
  name: iso3,
  name_formal: null,
  region_slug: region,
  un_subregion: null,
  population,
  lon: 10,
  lat: 50,
  bbox: [1, 2, 3, 4],
  blurb: null,
  tagline: "",
  profile_html: "",
  featured_indicators: [],
});

const snapshot: AtlasSnapshot = {
  regions: [
    {
      slug: "europe",
      name: "Europe",
      tagline: "",
      fill: "#aabbcc",
      stroke: "#112233",
      center_lon: 15,
      center_lat: 50,
      zoom: 3,
      summary: "",
      hero_url: null,
      hero_credit: "",
    },
  ],
  countries: [
    country("CZE", "europe", 10),
    country("DEU", "europe", 80),
    country("ATA", "europe", 0), // Antarktida profil nemá
    country("XXX", null, 5), // bez regionu = bez profilu
  ],
  countryMetrics: [
    {
      country_iso3: "CZE",
      value: "5",
      label: "Castles",
      description: "",
      source: "Atlas",
      source_url: null,
      year: 2024,
      period: null,
    },
  ],
  indicators: [
    {
      id: "hdi",
      label: "Human Development Index",
      short_label: "HDI",
      description: "",
      unit: "",
      decimals: 3,
      source: "UNDP",
      source_url: "https://hdr.undp.org",
      type: "sequential",
      scale: "linear",
      domain_min: 0.3,
      domain_max: 1,
      ramp: ["#000000", "#ffffff"],
      higher_is_better: true,
      latest_year: 2023,
    },
    {
      id: "regime",
      label: "Political regime",
      short_label: "",
      description: "",
      unit: "",
      decimals: 0,
      source: "V-Dem",
      source_url: null,
      type: "categorical",
      scale: "linear",
      domain_min: null,
      domain_max: null,
      ramp: [],
      higher_is_better: true,
      latest_year: 2024,
    },
  ],
  categories: [{ indicator_id: "regime", value: 3, label: "Liberal democracy", color: "#00ff00" }],
  values: [
    { indicator_id: "hdi", country_iso3: "CZE", value: 0.9, year: 2023 },
    { indicator_id: "hdi", country_iso3: "DEU", value: 0.95, year: 2023 },
    { indicator_id: "regime", country_iso3: "CZE", value: 3, year: null },
  ],
  issues: [
    {
      slug: "central",
      name: "Central",
      subtitle: "",
      summary: "",
      fill: "#ff0000",
      stroke: "#990000",
      center_lon: 15,
      center_lat: 50,
      zoom: 4,
      hero_url: null,
    },
  ],
  issueCountries: [{ special_slug: "central", country_iso3: "CZE" }],
};

const atlas = buildAtlas(snapshot, [
  { iso3: "CZE", iso2: "CZ", continent: "Europe", territoryNote: null },
]);

describe("buildAtlas", () => {
  it("profil mají jen země v regionu a mimo vyřazená území, od nejlidnatější", () => {
    expect(atlas.countries.map((c) => c.iso3)).toEqual(["DEU", "CZE"]);
    expect(atlas.regionBySlug.get("europe")?.countries).toEqual(["DEU", "CZE", "ATA"]);
  });

  it("spočítá pořadí v sekvenční vrstvě a formátuje hodnoty", () => {
    const hdi = atlas.countryByIso3.get("CZE")?.stats.find((stat) => stat.id === "hdi");
    expect(hdi).toMatchObject({ value: "0.900", rank: 2, rankOf: 2, year: 2023 });
  });

  it("kategoriální vrstva dá popisek kategorie, rok z ukazatele a žádné pořadí", () => {
    const regime = atlas.countryByIso3.get("CZE")?.stats.find((stat) => stat.id === "regime");
    expect(regime).toMatchObject({ value: "Liberal democracy", rank: null, year: 2024 });
    expect(atlas.indicatorById.get("regime")?.shortLabel).toBe("Political regime");
  });

  it("doplní geografická fakta a redakční profil", () => {
    const cze = atlas.countryBySlug.get("cze");
    expect(cze?.iso2).toBe("CZ");
    expect(cze?.bbox).toEqual([1, 2, 3, 4]);
    expect(cze?.profile.metrics).toEqual([
      expect.objectContaining({ label: "Castles", source: "Atlas", year: "2024" }),
    ]);
  });

  it("složí global issues a pomocné výběry", () => {
    expect(atlas.issueBySlug.get("central")?.countries).toEqual(["CZE"]);
    expect(countriesOf(atlas, ["CZE", "XXX", "DEU"]).map((c) => c.iso3)).toEqual(["DEU", "CZE"]);
    expect(regionColorMap(atlas.regions)).toMatchObject({ CZE: "#aabbcc", DEU: "#aabbcc" });
  });
});
