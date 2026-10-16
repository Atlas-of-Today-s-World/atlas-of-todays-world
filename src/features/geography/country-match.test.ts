import { describe, expect, it } from "vitest";
import generated from "@/data/countries.generated.json";
import { countryMatcher, normaliseName } from "./country-match";

interface Generated {
  iso3: string;
  iso2: string | null;
  name: string;
  nameFormal: string | null;
}

// The Atlas countries as the admin page passes them (display names aside).
const match = countryMatcher(
  (generated as Generated[]).map(({ iso3, iso2, name, nameFormal }) => ({
    iso3,
    iso2,
    name,
    nameFormal,
  })),
);
const iso3 = (cell: string) => {
  const found = match(cell);
  return found.kind === "country" ? found.iso3 : found.kind;
};

describe("normaliseName", () => {
  it("drops case, accents and punctuation", () => {
    expect(normaliseName("  Côte d’Ivoire ")).toBe("cote d ivoire");
    expect(normaliseName("Bosnia & Herzegovina")).toBe("bosnia and herzegovina");
    expect(normaliseName("Türkiye")).toBe("turkiye");
  });
});

describe("countryMatcher", () => {
  it("matches ISO3 and ISO2 codes, in any case", () => {
    expect(match("CZE")).toEqual({ kind: "country", iso3: "CZE", by: "code" });
    expect(iso3("cz")).toBe("CZE");
    expect(iso3(" deu ")).toBe("DEU");
  });

  it("fills ISO2 gaps of the map data and other datasets' codes", () => {
    expect(iso3("NO")).toBe("NOR");
    expect(iso3("FR")).toBe("FRA");
    expect(iso3("XK")).toBe("XKX");
    expect(iso3("OWID_KOS")).toBe("XKX");
    expect(iso3("KSV")).toBe("XKX");
    expect(iso3("TW")).toBe("TWN");
  });

  it("matches names and formal names without case, accents or punctuation", () => {
    expect(match("czechia")).toEqual({ kind: "country", iso3: "CZE", by: "name" });
    expect(iso3("Czech Republic")).toBe("CZE");
    expect(iso3("Russian Federation")).toBe("RUS");
    expect(iso3("United States of America")).toBe("USA");
    expect(iso3("Côte d'Ivoire")).toBe("CIV");
    expect(iso3("COTE D'IVOIRE")).toBe("CIV");
    expect(iso3("Syrian Arab Republic")).toBe("SYR");
    expect(iso3("Kyrgyz Republic")).toBe("KGZ");
    expect(iso3("Slovak Republic")).toBe("SVK");
  });

  it("knows the World Bank, UN and OWID spellings", () => {
    const cases: Record<string, string> = {
      Türkiye: "TUR",
      Turkey: "TUR",
      "Korea, Rep.": "KOR",
      "Korea, Dem. People's Rep.": "PRK",
      "Iran, Islamic Rep.": "IRN",
      "Iran (Islamic Republic of)": "IRN",
      "Viet Nam": "VNM",
      "Congo, Dem. Rep.": "COD",
      "Democratic Republic of Congo": "COD",
      "Congo, Rep.": "COG",
      Congo: "COG",
      "Egypt, Arab Rep.": "EGY",
      "Lao PDR": "LAO",
      "Gambia, The": "GMB",
      "Bahamas, The": "BHS",
      "Micronesia, Fed. Sts.": "FSM",
      "Micronesia (country)": "FSM",
      "Yemen, Rep.": "YEM",
      "Venezuela, RB": "VEN",
      "Hong Kong SAR, China": "HKG",
      "Macao SAR, China": "MAC",
      "St. Lucia": "LCA",
      "St. Vincent and the Grenadines": "VCT",
      "Cabo Verde": "CPV",
      Eswatini: "SWZ",
      "West Bank and Gaza": "PSE",
      "South Sudan": "SSD",
      "Equatorial Guinea": "GNQ",
      "Bolivia (Plurinational State of)": "BOL",
      "Brunei Darussalam": "BRN",
      "Virgin Islands (U.S.)": "VIR",
    };
    for (const [cell, expected] of Object.entries(cases)) expect(iso3(cell), cell).toBe(expected);
  });

  it("recognises World Bank and OWID aggregates — but a country is a country first", () => {
    for (const cell of [
      "WLD",
      "World",
      "EUU",
      "European Union",
      "Upper middle income",
      "High income",
      "Sub-Saharan Africa",
      "Europe & Central Asia",
      "Latin America & Caribbean",
      "IDA only",
      "OWID_WRL",
      "Africa (WHO)",
      "High-income countries",
      "Euro area",
      "Small states",
    ]) {
      expect(match(cell), cell).toEqual({ kind: "aggregate" });
    }
    expect(iso3("South Africa")).toBe("ZAF");
    expect(iso3("Central African Republic")).toBe("CAF");
    expect(iso3("United States")).toBe("USA");
  });

  it("leaves unknown or empty cells unmatched", () => {
    expect(match("Atlantis")).toEqual({ kind: "none" });
    expect(match("")).toEqual({ kind: "none" });
    expect(match("Korea")).toEqual({ kind: "none" });
  });

  it("matches only countries it was given, and drops a name two countries share", () => {
    const small = countryMatcher([
      { iso3: "AAA", name: "Twin" },
      { iso3: "BBB", name: "Twin" },
      { iso3: "CZE", name: "Czechia" },
    ]);
    expect(small("Twin")).toEqual({ kind: "none" });
    expect(small("Russian Federation")).toEqual({ kind: "none" });
    expect(small("Czech Republic")).toEqual({ kind: "none" });
    expect(small("Czech Rep.")).toEqual({ kind: "country", iso3: "CZE", by: "name" });
    expect(small("XK")).toEqual({ kind: "none" });
  });
});
