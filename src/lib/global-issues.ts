import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Vlastní („issue") regiony. Na rozdíl od devíti regionů Atlasu je neurčuje
 * kód, ale obsah – redakce si je skládá z libovolných zemí v administraci.
 * Můžou klidně křížit hranice regionů Atlasu, o to tu jde.
 */
export interface GlobalIssue {
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

const FILE = join(process.cwd(), "src", "content", "global-issues.json");

let cache: GlobalIssue[] | null = null;

function invalidateGlobalIssues() {
  cache = null;
}

export async function allGlobalIssues(): Promise<GlobalIssue[]> {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(await readFile(FILE, "utf8"));
    cache = Array.isArray(parsed) ? (parsed as GlobalIssue[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

export async function globalIssueBySlug(slug: string): Promise<GlobalIssue | null> {
  const all = await allGlobalIssues();
  return all.find((region) => region.slug === slug) ?? null;
}

export async function saveGlobalIssues(regions: GlobalIssue[]) {
  await writeFile(FILE, `${JSON.stringify(regions, null, 2)}\n`, "utf8");
  invalidateGlobalIssues();
}

/** ISO3 -> barva. Když je země ve dvou celcích, vyhrává ten první v pořadí. */
export async function issueColorMap(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const region of await allGlobalIssues()) {
    for (const iso3 of region.countries) {
      if (!out[iso3]) out[iso3] = region.fill;
    }
  }
  return out;
}

/** Podklad pro globus: ISO3 -> slug celku a slug -> jeho země. */
export async function issueLookup() {
  const regions = await allGlobalIssues();
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
