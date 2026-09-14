import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import { REGION_BY_SLUG, type Region } from "@/data/regions";
import {
  ENTRY_CATEGORIES,
  type EntryCategory,
  type EntryFrontmatter,
  type RegionDossier,
} from "@/lib/content-types";

export * from "@/lib/content-types";

const CONTENT_DIR = join(process.cwd(), "src", "content");
const ENTRIES_DIR = join(CONTENT_DIR, "entries");

export interface Entry extends EntryFrontmatter {
  slug: string;
  html: string;
  plain: string;
  regionRef: Region | null;
}

let entryCache: Entry[] | null = null;

export async function allEntries(): Promise<Entry[]> {
  if (entryCache) return entryCache;

  let files: string[] = [];
  try {
    files = (await readdir(ENTRIES_DIR)).filter((name) => name.endsWith(".md"));
  } catch {
    return [];
  }

  const entries = await Promise.all(
    files.map(async (file) => {
      const source = await readFile(join(ENTRIES_DIR, file), "utf8");
      const { data, content } = matter(source);
      const frontmatter = data as EntryFrontmatter;
      return {
        ...frontmatter,
        slug: file.replace(/\.md$/, ""),
        html: await marked.parse(content),
        plain: content.replace(/[#*_>`[\]()]/g, " ").replace(/\s+/g, " ").trim(),
        regionRef: REGION_BY_SLUG[frontmatter.region] ?? null,
      } satisfies Entry;
    }),
  );

  entryCache = entries.sort((a, b) =>
    (b.published ?? "").localeCompare(a.published ?? ""),
  );
  return entryCache;
}

export async function entryBySlug(slug: string): Promise<Entry | null> {
  const entries = await allEntries();
  return entries.find((entry) => entry.slug === slug) ?? null;
}

export async function entriesOfRegion(regionSlug: string): Promise<Entry[]> {
  const entries = await allEntries();
  return entries.filter((entry) => entry.region === regionSlug);
}

export async function entriesOfCountry(iso3: string): Promise<Entry[]> {
  const entries = await allEntries();
  return entries.filter((entry) => entry.countries?.includes(iso3));
}

/** Redakční doplňky portrétu regionu; když soubor chybí, sekce se nevykreslí. */
export async function regionDossier(slug: string): Promise<RegionDossier> {
  try {
    const source = await readFile(
      join(CONTENT_DIR, "regions", `${slug}.json`),
      "utf8",
    );
    return JSON.parse(source) as RegionDossier;
  } catch {
    return {};
  }
}

/**
 * Redakční text ke konkrétní zemi (src/content/countries/<slug>.md).
 * Když chybí, karta země použije větu složenou z importovaných dat – díky tomu
 * má profil i těch ~190 zemí, ke kterým redakce zatím nic nenapsala.
 */
export async function countryProfile(
  slug: string,
): Promise<{ summary: string; html: string } | null> {
  try {
    const source = await readFile(
      join(CONTENT_DIR, "countries", `${slug}.md`),
      "utf8",
    );
    const { data, content } = matter(source);
    return {
      summary: (data as { summary?: string }).summary ?? "",
      html: await marked.parse(content),
    };
  } catch {
    return null;
  }
}

export { ENTRY_CATEGORIES };
export type { EntryCategory };
