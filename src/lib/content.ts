import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { REGION_BY_SLUG, type Region } from "@/data/regions";
import {
  NEWS_CATEGORIES,
  type NewsCategory,
  type NewsFrontmatter,
  type RegionDossier,
} from "@/lib/content-types";

export * from "@/lib/content-types";

/**
 * Markdown smí do stránky, ale ne jako libovolné HTML.
 *
 * Text píše redakce přes administraci, takže do něj může spadnout `<script>`
 * nebo `onclick` – buď omylem, nebo když se někdo do administrace dostane.
 * Povolujeme proto jen značky, které encyklopedické heslo potřebuje, a u odkazů
 * jen http(s) a kotvy.
 */
function toSafeHtml(markdown: string): string {
  return sanitizeHtml(marked.parse(markdown, { async: false }) as string, {
    allowedTags: [
      "h2", "h3", "h4", "p", "blockquote", "ul", "ol", "li", "strong", "em",
      "a", "code", "pre", "hr", "br", "table", "thead", "tbody", "tr", "th",
      "td", "figure", "figcaption", "img", "sup", "sub",
    ],
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "title", "loading"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      // Odkazy ven nesmí dostat přístup k našemu oknu.
      a: sanitizeHtml.simpleTransform("a", { rel: "noreferrer noopener" }),
      img: sanitizeHtml.simpleTransform("img", { loading: "lazy" }),
    },
  });
}

const CONTENT_DIR = join(process.cwd(), "src", "content");
const NEWS_DIR = join(CONTENT_DIR, "news");

export interface NewsItem extends NewsFrontmatter {
  slug: string;
  html: string;
  plain: string;
  regionRef: Region | null;
}

let newsCache: NewsItem[] | null = null;

/** Po zápisu nového novinky je potřeba zahodit cache, jinak se neobjeví. */
export function invalidateNews() {
  newsCache = null;
}

export async function allNews(): Promise<NewsItem[]> {
  if (newsCache) return newsCache;

  let files: string[] = [];
  try {
    files = (await readdir(NEWS_DIR)).filter((name) => name.endsWith(".md"));
  } catch {
    return [];
  }

  const newsItems = await Promise.all(
    files.map(async (file) => {
      const source = await readFile(join(NEWS_DIR, file), "utf8");
      const { data, content } = matter(source);
      const frontmatter = data as NewsFrontmatter;
      return {
        ...frontmatter,
        slug: file.replace(/\.md$/, ""),
        html: toSafeHtml(content),
        plain: content.replace(/[#*_>`[\]()]/g, " ").replace(/\s+/g, " ").trim(),
        regionRef: REGION_BY_SLUG[frontmatter.region] ?? null,
      } satisfies NewsItem;
    }),
  );

  newsCache = newsItems.sort((a, b) =>
    (b.published ?? "").localeCompare(a.published ?? ""),
  );
  return newsCache;
}

export async function newsBySlug(slug: string): Promise<NewsItem | null> {
  const newsItems = await allNews();
  return newsItems.find((item) => item.slug === slug) ?? null;
}

export async function newsOfRegion(regionSlug: string): Promise<NewsItem[]> {
  const newsItems = await allNews();
  return newsItems.filter((item) => item.region === regionSlug);
}

export async function newsOfCountry(iso3: string): Promise<NewsItem[]> {
  const newsItems = await allNews();
  return newsItems.filter((item) => item.countries?.includes(iso3));
}

/** Novinky přiřazené přímo k vlastnímu celku (pole `issue` ve frontmatteru). */
export async function newsOfGlobalIssue(issueSlug: string): Promise<NewsItem[]> {
  const newsItems = await allNews();
  return newsItems.filter((item) => item.issue === issueSlug);
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
      html: toSafeHtml(content),
    };
  } catch {
    return null;
  }
}

export { NEWS_CATEGORIES };
export type { NewsCategory };
