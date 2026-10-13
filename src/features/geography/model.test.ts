import { describe, expect, it } from "vitest";
import {
  buildAtlas,
  countriesOf,
  countryStats,
  displayName,
  indicatorData,
  regionColorMap,
  territoryNote,
  type AtlasSnapshot,
  type IndicatorValues,
} from "./model";

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
      content_status: "ready",
    },
  ],
  countries: [
    country("CZE", "europe", 10),
    country("DEU", "europe", 80),
    country("ATA", "europe", 0), // Antarctica has no profile
    country("XXX", null, 5), // no region = no profile
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
      kind: "region",
    },
  ],
  issueCountries: [{ special_slug: "central", country_iso3: "CZE" }],
  theme: { saturation: 0.8, border: 1.5 },
  areas: [],
};

const atlas = buildAtlas(snapshot, [
  { iso3: "CZE", iso2: "CZ", continent: "Europe", territoryNote: null },
]);

/** Values as cached per indicator, apart from the snapshot. */
const cached: Record<string, IndicatorValues> = {
  hdi: { ATA: [0.5, 2023], CZE: [0.9, 2023], DEU: [0.95, 2023] },
  regime: { CZE: [3, null] },
};
const layers = atlas.indicators.map((indicator) =>
  indicatorData(indicator, cached[indicator.id] ?? {}),
);

describe("buildAtlas", () => {
  it("only countries in a region and not excluded territories have a profile, most populous first", () => {
    expect(atlas.countries.map((c) => c.iso3)).toEqual(["DEU", "CZE"]);
    expect(atlas.regionBySlug.get("europe")?.countries).toEqual(["DEU", "CZE", "ATA"]);
  });

  it("keeps indicator definitions without their values", () => {
    expect(atlas.indicatorById.get("regime")?.shortLabel).toBe("Political regime");
    for (const indicator of atlas.indicators) {
      expect(indicator).not.toHaveProperty("values");
      expect(indicator).not.toHaveProperty("countryCount");
    }
  });

  it("adds geographic facts and the editorial profile", () => {
    const cze = atlas.countryBySlug.get("cze");
    expect(cze?.iso2).toBe("CZ");
    expect(cze?.bbox).toEqual([1, 2, 3, 4]);
    expect(cze?.profile.metrics).toEqual([
      expect.objectContaining({ label: "Castles", source: "Atlas", year: "2024" }),
    ]);
  });

  it("assembles global issues and helper options", () => {
    expect(atlas.issueBySlug.get("central")?.countries).toEqual(["CZE"]);
    // A custom region made of countries keeps its type (a different label on the site).
    expect(atlas.issueBySlug.get("central")?.kind).toBe("region");
    expect(countriesOf(atlas, ["CZE", "XXX", "DEU"]).map((c) => c.iso3)).toEqual(["DEU", "CZE"]);
    expect(regionColorMap(atlas.regions)).toMatchObject({ CZE: "#aabbcc", DEU: "#aabbcc" });
    expect(atlas.theme).toEqual({ saturation: 0.8, border: 1.5 });
  });

  it("reads the content status, a group without one is not started", () => {
    expect(atlas.regionBySlug.get("europe")?.contentStatus).toBe("ready");
    expect(atlas.issueBySlug.get("central")?.contentStatus).toBe("none");
  });
});

describe("indicatorData", () => {
  it("joins a definition with its cached values; a value without a year is from the latest", () => {
    const [hdi, regime] = layers;
    expect(hdi).toMatchObject({ id: "hdi", label: "Human Development Index", countryCount: 3 });
    expect(hdi?.values.CZE).toEqual({ value: 0.9, year: 2023 });
    expect(regime?.values).toEqual({ CZE: { value: 3, year: 2024 } });
  });

  it("an indicator without values has none", () => {
    const empty = indicatorData(atlas.indicators[0]!, {});
    expect(empty).toMatchObject({ countryCount: 0, values: {} });
  });
});

describe("countryStats", () => {
  it("ranks among every country with a value and formats it", () => {
    const hdi = countryStats("CZE", layers).find((stat) => stat.id === "hdi");
    expect(hdi).toEqual({
      id: "hdi",
      label: "Human Development Index",
      shortLabel: "HDI",
      value: "0.900",
      raw: 0.9,
      year: 2023,
      source: "UNDP",
      sourceUrl: "https://hdr.undp.org",
      rank: 2,
      rankOf: 3,
    });
    expect(countryStats("DEU", layers).find((stat) => stat.id === "hdi")?.rank).toBe(1);
  });

  it("a lower-is-better layer ranks the smallest value first", () => {
    const [hdi] = layers;
    const reversed = { ...hdi!, higherIsBetter: false };
    expect(countryStats("ATA", [reversed])[0]).toMatchObject({ rank: 1, rankOf: 3 });
  });

  it("categorical layer gives the category label, year from the indicator and no rank", () => {
    const regime = countryStats("CZE", layers).find((stat) => stat.id === "regime");
    expect(regime).toMatchObject({
      value: "Liberal democracy",
      rank: null,
      rankOf: null,
      year: 2024,
    });
  });

  it("follows the layer order and skips layers without the country's value", () => {
    expect(countryStats("CZE", layers).map((stat) => stat.id)).toEqual(["hdi", "regime"]);
    expect(countryStats("DEU", layers).map((stat) => stat.id)).toEqual(["hdi"]);
    expect(countryStats("XXX", layers)).toEqual([]);
  });
});

describe("displayName", () => {
  it("spells out abbreviated Natural Earth names from the formal name", () => {
    expect(displayName("Dem. Rep. Congo", "Democratic Republic of the Congo")).toBe(
      "Democratic Republic of the Congo",
    );
    expect(displayName("Bosnia and Herz.", "Bosnia and Herzegovina")).toBe(
      "Bosnia and Herzegovina",
    );
    expect(displayName("S. Sudan", "Republic of South Sudan")).toBe("South Sudan");
    expect(displayName("Marshall Is.", "Republic of the Marshall Islands")).toBe(
      "Marshall Islands",
    );
  });

  it("keeps names that are not abbreviated, or without a usable formal name", () => {
    expect(displayName("Germany", "Federal Republic of Germany")).toBe("Germany");
    expect(displayName("Syria", "Syrian Arab Republic")).toBe("Syria");
    expect(displayName("Eq. Guinea", null)).toBe("Eq. Guinea");
    expect(displayName("Faeroe Is.", "Føroyar Is. (Faeroe Is.)")).toBe("Faeroe Is.");
  });
});

describe("territoryNote", () => {
  const fact = {
    status: "disputed" as const,
    note: "From the map data.",
    basis: "UN resolution 1244 (1999)",
  };

  it("keeps the map data's note when the editors wrote none", () => {
    expect(territoryNote(fact, null)).toEqual(fact);
    expect(territoryNote(fact, "   ")).toEqual(fact);
    expect(territoryNote(null, null)).toBeNull();
  });

  it("shows the editors' text (which names its basis) after the map data's status", () => {
    expect(territoryNote(fact, " Edited note. Basis: X. ")).toEqual({
      status: "disputed",
      note: "Edited note. Basis: X.",
      basis: null,
    });
  });

  it("an edited note without a status from the map data stands alone", () => {
    expect(territoryNote(null, "A note.")).toEqual({ status: null, note: "A note.", basis: null });
  });
});

describe("buildAtlas: edited facts", () => {
  const edited = buildAtlas(
    {
      ...snapshot,
      countries: [{ ...country("CZE", "europe", 10), territory_note: "Edited." }],
      issues: snapshot.issues.map((issue) => ({ ...issue, hero_credit: "Photo: A. B." })),
      areas: [
        {
          slug: "lake",
          name: "Lake",
          label: "",
          country_iso3: "CZE",
          fill: "#0000ff",
          stroke: "#000099",
          geometry: { type: "Polygon", coordinates: [] },
        },
      ],
    },
    [{ iso3: "CZE", iso2: "CZ", continent: "Europe", territoryNote: null }],
  );

  it("carries the status note, the issue's photo credit and an area's country", () => {
    expect(edited.countryByIso3.get("CZE")?.territoryNote).toEqual({
      status: null,
      note: "Edited.",
      basis: null,
    });
    expect(edited.issues[0]?.heroCredit).toBe("Photo: A. B.");
    expect(edited.areas[0]?.countryIso3).toBe("CZE");
  });

  it("an issue without a credit has an empty one", () => {
    expect(atlas.issues[0]?.heroCredit).toBe("");
  });
});
