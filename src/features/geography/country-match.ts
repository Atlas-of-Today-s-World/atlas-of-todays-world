/**
 * Country names and codes as data files write them → the Atlas's ISO3 codes
 * (the data-layer CSV import). Pure and Zod-free: the import runs in the
 * browser.
 *
 * A cell matches, in this order: an ISO3 code of a country in the Atlas, an
 * ISO2 code, the Atlas name or formal name, or one of the spellings in ALIASES
 * (World Bank, UN and Our World in Data names) — compared without case,
 * accents and punctuation. Rows for the world, regions and income groups that
 * these files mix in are recognised as aggregates, so the import can skip
 * them instead of asking about each.
 */

export interface MatchCountry {
  iso3: string;
  name: string;
  nameFormal?: string | null;
  iso2?: string | null;
}

export type CountryMatch =
  { kind: "country"; iso3: string; by: "code" | "name" } | { kind: "aggregate" } | { kind: "none" };

/** "Côte d'Ivoire" → "cote d ivoire": lowercase ASCII words, "&" read as "and". */
export function normaliseName(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Other names of Atlas countries (only those the Atlas name and formal name
 * don't already cover). World Bank style first ("Korea, Rep."), then UN
 * ("Iran (Islamic Republic of)"), Our World in Data and common short forms.
 */
const ALIASES: Record<string, readonly string[]> = {
  BHS: ["Bahamas, The", "The Bahamas"],
  BOL: ["Bolivia (Plurinational State of)"],
  BRN: ["Brunei Darussalam"],
  CIV: ["Ivory Coast", "Cote d'Ivoire"],
  COD: [
    "Congo, Dem. Rep.",
    "Democratic Republic of Congo",
    "Congo, Democratic Republic of the",
    "Congo (Kinshasa)",
    "DR Congo",
    "DRC",
  ],
  COG: ["Congo, Rep.", "Republic of Congo", "Congo (Brazzaville)", "Congo-Brazzaville"],
  CPV: ["Cape Verde"],
  CZE: ["Czech Rep."],
  EGY: ["Egypt, Arab Rep."],
  FRO: ["Faroe Islands", "Faeroe Islands"],
  FSM: [
    "Micronesia, Fed. Sts.",
    "Micronesia (country)",
    "Micronesia (Federated States of)",
    "Federated States of Micronesia",
  ],
  GBR: ["UK", "Great Britain", "Britain"],
  GMB: ["Gambia, The", "The Gambia"],
  GNQ: ["Equatorial Guinea"],
  HKG: ["Hong Kong SAR, China", "Hong Kong, China", "China, Hong Kong SAR"],
  IRN: ["Iran, Islamic Rep.", "Iran (Islamic Republic of)"],
  KNA: ["Saint Kitts and Nevis", "St Kitts and Nevis"],
  KOR: ["Korea, Rep.", "Republic of Korea", "Korea, Republic of", "Korea (Republic of)"],
  PRK: [
    "Korea, Dem. People's Rep.",
    "Korea, Dem. Rep.",
    "Korea, Democratic People's Republic of",
    "Korea DPR",
  ],
  LAO: ["Lao PDR", "Lao"],
  LCA: ["St. Lucia", "St Lucia"],
  MAC: ["Macao SAR, China", "Macau", "China, Macao SAR"],
  MAF: ["St. Martin (French part)", "Saint Martin (French part)", "Saint Martin"],
  MDA: ["Moldova, Rep.", "Republic of Moldova"],
  MHL: ["Marshall Islands"],
  MKD: ["Macedonia", "Macedonia, FYR", "North Macedonia, Republic of"],
  MMR: ["Burma"],
  MNP: ["Northern Mariana Islands"],
  PCN: ["Pitcairn", "Pitcairn Islands"],
  PSE: [
    "Palestine, State of",
    "State of Palestine",
    "Palestinian Territories",
    "Palestinian territories",
  ],
  RUS: ["Russian Federation"],
  SSD: ["South Sudan"],
  STP: ["Sao Tome and Principe"],
  SWZ: ["Eswatini", "Swaziland"],
  SYR: ["Syrian Arab Republic"],
  TLS: ["East Timor"],
  TUR: ["Türkiye", "Turkiye"],
  TWN: ["Taiwan, China", "Taiwan Province of China", "Chinese Taipei"],
  TZA: ["Tanzania, United Republic of"],
  USA: ["United States", "USA", "U.S.", "US"],
  ARE: ["UAE"],
  VAT: ["Holy See", "Vatican City"],
  VCT: ["St. Vincent and the Grenadines", "Saint Vincent and the Grenadines"],
  VEN: ["Venezuela, RB", "Venezuela (Bolivarian Republic of)"],
  VGB: ["Virgin Islands (British)"],
  VIR: ["Virgin Islands (U.S.)", "United States Virgin Islands", "US Virgin Islands"],
  VNM: ["Viet Nam"],
  WLF: ["Wallis and Futuna"],
  YEM: ["Yemen, Rep."],
};

/**
 * Codes other datasets use for Atlas countries: retired ISO codes, the World
 * Bank's and OWID's Kosovo, and ISO2 codes Natural Earth leaves out (-99).
 */
const CODE_ALIASES: Record<string, string> = {
  KSV: "XKX",
  OWID_KOS: "XKX",
  XK: "XKX",
  ROM: "ROU",
  ZAR: "COD",
  TMP: "TLS",
  NO: "NOR",
  FR: "FRA",
  TW: "TWN",
};

/**
 * World Bank aggregate codes (world, regions, income and lending groups,
 * demographic dividend groups…). None of them is a country code.
 */
const AGGREGATE_CODES = new Set(
  (
    "AFE AFW ARB CEB CSS EAP EAR EAS ECA ECS EMU EUU FCS HIC HPC IBD IBT IDA IDB IDX INX LAC " +
    "LCN LDC LIC LMC LMY LTE MEA MIC MNA NAC OED OSS PRE PSS PST SAS SSA SSF SST TEA TEC TLA " +
    "TMN TSA TSS UMC WLD"
  ).split(" "),
);

/**
 * Words that mark a group of countries in an unmatched name ("World",
 * "Upper middle income", "Europe & Central Asia", "Africa (WHO)",
 * "European Union (27)"). Only tried after the country names, so
 * "South Africa" is still a country.
 */
const AGGREGATE_WORDS =
  /\b(world|income|countries|economies|region|regions|union|area|members|total|ida|ibrd|oecd|dividend|fragile|small states|sub saharan|latin america|east asia|south asia|middle east|north africa|north america|europe|asia|africa|oceania|caribbean|pacific|arab world|least developed|heavily indebted|excluding|excl|wb|un|who|fao|g20|g7)\b/;

/** A matcher over the Atlas's countries: `match(cell)` for one cell of the country column. */
export function countryMatcher(countries: readonly MatchCountry[]): (cell: string) => CountryMatch {
  const iso3 = new Set(countries.map((country) => country.iso3));
  const codes = new Map<string, string>();
  for (const [code, target] of Object.entries(CODE_ALIASES)) {
    if (iso3.has(target)) codes.set(code, target);
  }
  for (const country of countries) {
    if (country.iso2 && /^[A-Z]{2}$/.test(country.iso2)) codes.set(country.iso2, country.iso3);
    codes.set(country.iso3, country.iso3);
  }

  // A name two countries share would be a guess: it's left out.
  const names = new Map<string, string | null>();
  const add = (name: string | null | undefined, target: string) => {
    if (!name || !iso3.has(target)) return;
    const key = normaliseName(name);
    if (!key) return;
    const known = names.get(key);
    names.set(key, known === undefined || known === target ? target : null);
  };
  for (const country of countries) {
    add(country.name, country.iso3);
    add(country.nameFormal, country.iso3);
  }
  for (const [target, aliases] of Object.entries(ALIASES)) {
    for (const alias of aliases) {
      if (!names.has(normaliseName(alias))) add(alias, target);
    }
  }

  return (cell) => {
    const text = cell.trim();
    if (!text) return { kind: "none" };
    const code = text.toUpperCase();
    const byCode = codes.get(code);
    if (byCode) return { kind: "country", iso3: byCode, by: "code" };
    const key = normaliseName(text);
    const byName = names.get(key);
    if (byName) return { kind: "country", iso3: byName, by: "name" };
    if (AGGREGATE_CODES.has(code) || code.startsWith("OWID_") || AGGREGATE_WORDS.test(key)) {
      return { kind: "aggregate" };
    }
    return { kind: "none" };
  };
}
