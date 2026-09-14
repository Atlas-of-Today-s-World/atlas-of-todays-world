/**
 * Světové regiony Atlasu a jejich obsazení zeměmi (ISO 3166-1 alpha-3).
 *
 * Barvy odpovídají "Encyclopedia view" ve Figmě: každý region má vlastní
 * pastelovou výplň a sytější obrys. Kdo chce region přebarvit nebo přesunout
 * zemi jinam, mění jen tenhle soubor.
 */

export type RegionId =
  | "western-central-europe"
  | "eastern-europe-central-asia"
  | "middle-east-north-africa"
  | "sub-saharan-africa"
  | "south-asia"
  | "east-asia"
  | "southeast-asia-oceania"
  | "north-america"
  | "latin-america-caribbean";

export interface Region {
  id: RegionId;
  /** URL segment: /region/<slug> */
  slug: string;
  name: string;
  /** Podtitul na kartě regionu. */
  tagline: string;
  /** Výplň zemí regionu na globusu. */
  fill: string;
  /** Obrys regionu (silnější linka po obvodu). */
  stroke: string;
  /** Kam se globus otočí, když region otevřeš: [lon, lat] a zoom. */
  center: [number, number];
  zoom: number;
  /** Fotka do hlavičky portrétu regionu. */
  hero: string;
  heroCredit: string;
  /** Perex – zobrazuje se v panelu mapy i jako meta description. */
  summary: string;
  countries: string[];
}

export const REGIONS: Region[] = [
  {
    id: "eastern-europe-central-asia",
    slug: "eastern-europe-central-asia",
    name: "Eastern Europe & Central Asia",
    tagline: "A Comprehensive Portrait with global perspective",
    fill: "#E08585",
    stroke: "#B03A2E",
    center: [62, 52],
    zoom: 2.1,
    hero: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&q=70",
    heroCredit: "NASA / Unsplash",
    summary:
      "Eastern Europe is a region shaped by resilience, where imperial facades, communist blocks, and modern glass towers coexist, reflecting a past that still influences daily life. Society balances tradition with rapid change, navigating political skepticism, economic transition, and European integration. Living conditions vary between vibrant capitals and modest provincial towns, where hard work, education, and family networks remain central. Pragmatic, resourceful, and quietly ambitious, the region moves between memory and progress with persistent strength.",
    countries: [
      "RUS", "UKR", "BLR", "MDA", "GEO", "ARM", "AZE",
      "KAZ", "KGZ", "TJK", "TKM", "UZB",
    ],
  },
  {
    id: "western-central-europe",
    slug: "western-central-europe",
    name: "Western & Central Europe",
    tagline: "A Comprehensive Portrait with global perspective",
    fill: "#A9B5E8",
    stroke: "#4A5AA8",
    center: [10, 50],
    zoom: 2.6,
    hero: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=1600&q=70",
    heroCredit: "Unsplash",
    summary:
      "A dense cluster of small states bound by a single market, open borders and a shared postwar promise of prosperity. Western and Central Europe combines some of the world's highest living standards with ageing populations, contested migration politics and an energy transition that reshapes its industry. Its societies are secular, highly urbanised and deeply networked — and increasingly aware that the security order they took for granted is no longer given.",
    countries: [
      "ALB", "AND", "AUT", "BEL", "BIH", "BGR", "CHE", "CYP", "CZE", "DEU",
      "DNK", "ESP", "EST", "FIN", "FRA", "GBR", "GRC", "HRV", "HUN", "IRL",
      "ISL", "ITA", "LIE", "LTU", "LUX", "LVA", "MCO", "MKD", "MLT", "MNE",
      "NLD", "NOR", "POL", "PRT", "ROU", "SMR", "SRB", "SVK", "SVN", "SWE",
      "VAT", "XKX", "FRO", "IMN", "JEY", "GGY", "ALA",
    ],
  },
  {
    id: "middle-east-north-africa",
    slug: "middle-east-north-africa",
    name: "Middle East & North Africa",
    tagline: "A Comprehensive Portrait with global perspective",
    fill: "#F2E3AE",
    stroke: "#B99334",
    center: [35, 27],
    zoom: 2.4,
    hero: "https://images.unsplash.com/photo-1504198266287-1659872e6590?w=1600&q=70",
    heroCredit: "Unsplash",
    summary:
      "From the Atlantic coast of Morocco to the Iranian plateau, MENA is young, urban and unevenly rich. Hydrocarbon wealth has built city-states of extraordinary affluence next to countries hollowed out by war and sanctions. Water scarcity, a population bulge entering the labour market and the slow unwinding of the post-2011 settlements define the decade ahead.",
    countries: [
      "DZA", "BHR", "EGY", "IRN", "IRQ", "ISR", "JOR", "KWT", "LBN", "LBY",
      "MAR", "OMN", "PSE", "QAT", "SAU", "SYR", "TUN", "TUR", "ARE", "YEM",
      "ESH",
    ],
  },
  {
    id: "sub-saharan-africa",
    slug: "sub-saharan-africa",
    name: "Sub-Saharan Africa",
    tagline: "A Comprehensive Portrait with global perspective",
    fill: "#9ED6C0",
    stroke: "#2E8B6E",
    center: [20, 0],
    zoom: 2.1,
    hero: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1600&q=70",
    heroCredit: "Unsplash",
    summary:
      "The world's youngest region and the one that will supply most of the next generation of workers. Sub-Saharan Africa spans forty-nine countries with little in common beyond that label: stable middle-income democracies, fast-urbanising giants, and a Sahel belt where state authority is retreating. Mobile-first economies, a continental free-trade area and a scramble over critical minerals are rewriting how the region connects to the world.",
    countries: [
      "AGO", "BEN", "BWA", "BFA", "BDI", "CPV", "CMR", "CAF", "TCD", "COM",
      "COG", "COD", "CIV", "DJI", "GNQ", "ERI", "SWZ", "ETH", "GAB", "GMB",
      "GHA", "GIN", "GNB", "KEN", "LSO", "LBR", "MDG", "MWI", "MLI", "MRT",
      "MUS", "MOZ", "NAM", "NER", "NGA", "RWA", "STP", "SEN", "SYC", "SLE",
      "SOM", "ZAF", "SSD", "SDN", "TZA", "TGO", "UGA", "ZMB", "ZWE", "SOL",
    ],
  },
  {
    id: "south-asia",
    slug: "south-asia",
    name: "South Asia",
    tagline: "A Comprehensive Portrait with global perspective",
    fill: "#E8C39E",
    stroke: "#B5742E",
    center: [78, 22],
    zoom: 2.8,
    hero: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1600&q=70",
    heroCredit: "Unsplash",
    summary:
      "A quarter of humanity on three percent of the world's land. South Asia holds the fastest-growing large economy, two nuclear-armed rivals and the populations most exposed to heat and flooding. Rapid growth in services sits beside persistent malnutrition; democratic forms sit beside tightening control of media and courts.",
    countries: ["AFG", "BGD", "BTN", "IND", "MDV", "NPL", "PAK", "LKA"],
  },
  {
    id: "east-asia",
    slug: "east-asia",
    name: "East Asia",
    tagline: "A Comprehensive Portrait with global perspective",
    fill: "#C7A9E8",
    stroke: "#7048A8",
    center: [115, 36],
    zoom: 2.6,
    hero: "https://images.unsplash.com/photo-1480796927426-f609979314bd?w=1600&q=70",
    heroCredit: "Unsplash",
    summary:
      "The workshop of the global economy and the arena where the century's central rivalry plays out. East Asia has the world's densest manufacturing networks, its most advanced chip industry and its steepest demographic decline. Taiwan, the Korean peninsula and the East China Sea keep military risk permanently on the agenda.",
    countries: ["CHN", "HKG", "JPN", "KOR", "PRK", "MAC", "MNG", "TWN"],
  },
  {
    id: "southeast-asia-oceania",
    slug: "southeast-asia-oceania",
    name: "Southeast Asia & Oceania",
    tagline: "A Comprehensive Portrait with global perspective",
    fill: "#9ED0E8",
    stroke: "#2E7FA8",
    center: [125, -8],
    zoom: 2.2,
    hero: "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=1600&q=70",
    heroCredit: "Unsplash",
    summary:
      "An archipelagic world of trade routes, hedging diplomacy and climate exposure. Southeast Asia is growing fast and industrialising as supply chains diversify out of China, while the Pacific island states negotiate their sovereignty between great powers and rising seas. Australia and New Zealand anchor the region's wealthy, resource-heavy south.",
    countries: [
      "BRN", "KHM", "IDN", "LAO", "MYS", "MMR", "PHL", "SGP", "THA", "TLS",
      "VNM", "AUS", "NZL", "PNG", "FJI", "SLB", "VUT", "WSM", "TON", "KIR",
      "FSM", "MHL", "NRU", "PLW", "TUV", "NCL", "PYF", "ASM", "GUM", "MNP",
      "COK", "NIU",
    ],
  },
  {
    id: "north-america",
    slug: "north-america",
    name: "North America",
    tagline: "A Comprehensive Portrait with global perspective",
    fill: "#B9D8A6",
    stroke: "#4F8C3A",
    center: [-100, 48],
    zoom: 2.2,
    hero: "https://images.unsplash.com/photo-1485738422979-f5c462d49f74?w=1600&q=70",
    heroCredit: "Unsplash",
    summary:
      "Two wealthy federations and the world's largest military and financial power. North America sets much of the technological and cultural agenda others react to, while its own politics turn on polarisation, migration at the southern border and the cost of housing and healthcare.",
    countries: ["USA", "CAN", "GRL", "BMU", "SPM"],
  },
  {
    id: "latin-america-caribbean",
    slug: "latin-america-caribbean",
    name: "Latin America & the Caribbean",
    tagline: "A Comprehensive Portrait with global perspective",
    fill: "#F0B9D2",
    stroke: "#B84A80",
    center: [-62, -15],
    zoom: 2.1,
    hero: "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=1600&q=70",
    heroCredit: "Unsplash",
    summary:
      "The most urbanised region of the global south and among the most unequal. Latin America swings between electoral cycles with unusual speed, carries some of the world's highest homicide rates, and holds resources — lithium, copper, soy, the Amazon — that the energy transition has made strategic.",
    countries: [
      "MEX", "GTM", "BLZ", "SLV", "HND", "NIC", "CRI", "PAN", "CUB", "DOM",
      "HTI", "JAM", "TTO", "BHS", "BRB", "PRI", "ARG", "BOL", "BRA", "CHL",
      "COL", "ECU", "GUY", "PRY", "PER", "SUR", "URY", "VEN", "GUF", "ATG",
      "DMA", "GRD", "KNA", "LCA", "VCT", "CUW", "ABW", "CYM", "TCA", "VGB",
      "VIR", "AIA", "MSR", "BLM", "MAF", "SXM", "BES", "FLK",
    ],
  },
];

/** ISO3 -> region, postavené jednou při startu. */
export const REGION_BY_COUNTRY: Record<string, Region> = Object.fromEntries(
  REGIONS.flatMap((region) => region.countries.map((iso3) => [iso3, region])),
);

export const REGION_BY_SLUG: Record<string, Region> = Object.fromEntries(
  REGIONS.map((region) => [region.slug, region]),
);

export function regionOf(iso3: string | null | undefined): Region | null {
  if (!iso3) return null;
  return REGION_BY_COUNTRY[iso3] ?? null;
}
