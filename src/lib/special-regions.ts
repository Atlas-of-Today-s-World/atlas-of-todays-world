import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Vlastní („special") regiony. Na rozdíl od devíti regionů Atlasu je neurčuje
 * kód, ale obsah – redakce si je skládá z libovolných zemí v administraci.
 * Můžou klidně křížit hranice regionů Atlasu, o to tu jde.
 */
export interface SpecialRegion {
  slug: string;
  name: string;
  /** Podtitul: čím je ten celek vymezený. */
  subtitle: string;
  summary: string;
  /** Výplň zemí na globusu. */
  fill: string;
  /** Obrys celku. */
  stroke: string;
  center: [number, number];
  zoom: number;
  /** ISO 3166-1 alpha-3 kódy členských zemí. */
  countries: string[];
}

const FILE = join(process.cwd(), "src", "content", "special-regions.json");

let cache: SpecialRegion[] | null = null;

export function invalidateSpecialRegions() {
  cache = null;
}

export async function allSpecialRegions(): Promise<SpecialRegion[]> {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(await readFile(FILE, "utf8"));
    cache = Array.isArray(parsed) ? (parsed as SpecialRegion[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

export async function specialRegionBySlug(
  slug: string,
): Promise<SpecialRegion | null> {
  const all = await allSpecialRegions();
  return all.find((region) => region.slug === slug) ?? null;
}

export async function saveSpecialRegions(regions: SpecialRegion[]) {
  await writeFile(FILE, `${JSON.stringify(regions, null, 2)}\n`, "utf8");
  invalidateSpecialRegions();
}

/** ISO3 -> barva. Když je země ve dvou celcích, vyhrává ten první v pořadí. */
export async function specialColorMap(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const region of await allSpecialRegions()) {
    for (const iso3 of region.countries) {
      if (!out[iso3]) out[iso3] = region.fill;
    }
  }
  return out;
}

/** Podklad pro globus: ISO3 -> slug celku a slug -> jeho země. */
export async function specialLookup() {
  const regions = await allSpecialRegions();
  const slugByCountry: Record<string, string> = {};
  const bySlug: Record<string, { name: string; countries: string[] }> = {};

  for (const region of regions) {
    bySlug[region.slug] = { name: region.name, countries: region.countries };
    for (const iso3 of region.countries) {
      if (!slugByCountry[iso3]) slugByCountry[iso3] = region.slug;
    }
  }
  return { slugByCountry, bySlug };
}
