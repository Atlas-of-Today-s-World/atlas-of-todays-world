import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { NEWS_CATEGORIES } from "@/lib/content-types";
import { allNews, invalidateNews } from "@/lib/content";
import { REGION_BY_SLUG } from "@/data/regions";

export const dynamic = "force-dynamic";

const NEWS_DIR = join(process.cwd(), "src", "content", "news");

/**
 * Zápis novinek z administrace.
 *
 * MOCK: nemá autentizaci a zapisuje přímo do souborů v repozitáři, takže běží
 * jen lokálně a při vývoji. Před ostrým nasazením tohle nahradit redakčním
 * systémem (a hlavně přihlášením) – pak zmizí i /admin.
 */
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Frontmatter píšeme ručně – hodnoty escapujeme uvozovkami. */
function yamlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function refreshPaths(slug: string, region: string) {
  invalidateNews();
  revalidatePath("/news");
  revalidatePath("/admin");
  revalidatePath(`/news/${slug}`);
  if (region) {
    revalidatePath(`/region/${region}`);
    revalidatePath(`/region/${region}/full`);
  }
}

export async function GET() {
  const newsItems = await allNews();
  return NextResponse.json({
    newsItems: newsItems.map((item) => ({
      slug: item.slug,
      title: item.title,
      category: item.category,
      region: item.region,
      published: item.published ?? null,
    })),
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neplatný JSON." }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  const summary = String(body.summary ?? "").trim();
  const category = String(body.category ?? "").trim();
  const region = String(body.region ?? "").trim();
  const markdown = String(body.markdown ?? "").trim();

  if (!title) return NextResponse.json({ error: "Doplň název novinky." }, { status: 400 });
  if (!summary) return NextResponse.json({ error: "Doplň perex." }, { status: 400 });
  if (!markdown) return NextResponse.json({ error: "Doplň text novinky." }, { status: 400 });
  if (!NEWS_CATEGORIES.includes(category as (typeof NEWS_CATEGORIES)[number])) {
    return NextResponse.json({ error: "Neznámá kategorie." }, { status: 400 });
  }
  if (!REGION_BY_SLUG[region]) {
    return NextResponse.json({ error: "Neznámý region." }, { status: 400 });
  }

  const slug = slugify(String(body.slug ?? "").trim() || title);
  if (!slug) {
    return NextResponse.json({ error: "Z názvu nejde odvodit URL." }, { status: 400 });
  }

  const countries = Array.isArray(body.countries)
    ? body.countries.map(String).filter((iso) => /^[A-Z]{3}$/.test(iso))
    : [];
  const hero = String(body.hero ?? "").trim();
  const author = String(body.author ?? "").trim();
  const published = String(body.published ?? "").trim() ||
    new Date().toISOString().slice(0, 10);
  const words = markdown.split(/\s+/).length;

  const frontmatter = [
    "---",
    `title: ${yamlString(title)}`,
    `summary: ${yamlString(summary)}`,
    `category: ${yamlString(category)}`,
    `region: ${yamlString(region)}`,
    countries.length ? `countries: [${countries.map(yamlString).join(", ")}]` : null,
    hero ? `hero: ${yamlString(hero)}` : null,
    author ? `author: ${yamlString(author)}` : null,
    `published: ${yamlString(published)}`,
    `readingMinutes: ${Math.max(1, Math.round(words / 220))}`,
    "---",
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");

  await writeFile(join(NEWS_DIR, `${slug}.md`), `${frontmatter}${markdown}\n`, "utf8");
  refreshPaths(slug, region);

  return NextResponse.json({ ok: true, slug, url: `/news/${slug}` });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = slugify(searchParams.get("slug") ?? "");
  if (!slug) return NextResponse.json({ error: "Chybí slug." }, { status: 400 });

  const newsItems = await allNews();
  const item = newsItems.find((item) => item.slug === slug);
  if (!item) return NextResponse.json({ error: "Novinka neexistuje." }, { status: 404 });

  await unlink(join(NEWS_DIR, `${slug}.md`));
  refreshPaths(slug, item.region);

  return NextResponse.json({ ok: true });
}
