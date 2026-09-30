import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { requirePermission } from "@/features/auth/access";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import matter from "gray-matter";
import { REGION_BY_SLUG } from "@/data/regions";
import { countryBySlug } from "@/lib/countries";
import type { MetricCard, RegionDossier } from "@/lib/content-types";

export const dynamic = "force-dynamic";

/**
 * Redakční nastavení jedné země nebo jednoho regionu.
 *
 * Zeměpisná a statistická data přicházejí z Natural Earth a Our World in Data
 * a nejdou tady měnit – ta se obnovují `npm run data:all`. Tahle routa spravuje
 * jen to, co k nim píše redakce: úvodní text, podtitulek, výběr automatických
 * ukazatelů a ručně zadané ukazatele s citací.
 *
 * Zámek obstarává `src/middleware.ts`; sem se bez cookie administrace
 * nedostane. Cesta k souboru se **nikdy** neskládá ze vstupu – slug musí
 * odpovídat známé zemi nebo regionu, jinak požadavek končí 400.
 */
const CONTENT_DIR = join(process.cwd(), "src", "content");

/** Stropy na délku. Bez nich umí jeden požadavek zapsat libovolně velký soubor. */
const LIMITS = {
  summary: 600,
  tagline: 200,
  intro: 4000,
  markdown: 80_000,
  metrics: 8,
  metricValue: 24,
  metricLabel: 80,
  metricDescription: 400,
  metricSource: 120,
  metricYear: 24,
} as const;

function text(value: unknown, max: number): string {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

/** Odkaz na zdroj smí být jen http(s) – jinak by se dal podstrčit `javascript:`. */
function httpUrl(value: unknown): string {
  const raw = text(value, 500);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

/**
 * Karty ukazatelů. Prázdné řádky formuláře zahazujeme, neúplné odmítáme —
 * podle zadání se ukazatel bez citace nepublikuje, takže je lepší to říct
 * redaktorovi hned, než kartu tiše spolknout.
 */
function readMetrics(input: unknown): { metrics: MetricCard[] } | { error: string } {
  if (input === undefined || input === null) return { metrics: [] };
  if (!Array.isArray(input)) return { error: "Ukazatele musí být seznam." };
  if (input.length > LIMITS.metrics) {
    return { error: `Nejvíc ${LIMITS.metrics} ukazatelů.` };
  }

  const metrics: MetricCard[] = [];
  for (const [index, raw] of input.entries()) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const value = text(row.value, LIMITS.metricValue);
    const label = text(row.label, LIMITS.metricLabel);
    const source = text(row.source, LIMITS.metricSource);

    if (!value && !label && !source && !text(row.description, 1)) continue;
    if (!value || !label) {
      return { error: `Ukazatel ${index + 1}: doplň hodnotu i název.` };
    }
    if (!source) {
      return {
        error: `Ukazatel ${index + 1} („${label}"): doplň zdroj. Bez citace se karta nepublikuje.`,
      };
    }

    metrics.push({
      value,
      label,
      source,
      description: text(row.description, LIMITS.metricDescription) || undefined,
      sourceUrl: httpUrl(row.sourceUrl) || undefined,
      year: text(row.year, LIMITS.metricYear) || undefined,
    });
  }
  return { metrics };
}

export async function POST(request: Request) {
  const gate = await requirePermission("regions", "e");
  if ("response" in gate) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Neplatný JSON." }, { status: 400 });
  }

  const kind = String(body.kind ?? "");
  const slug = String(body.slug ?? "");

  const parsed = readMetrics(body.metrics);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (kind === "country") {
    const country = countryBySlug(slug);
    if (!country) {
      return NextResponse.json({ error: "Neznámá země." }, { status: 400 });
    }

    const featured = Array.isArray(body.featured)
      ? body.featured
          .map(String)
          .filter((id) => /^[a-z0-9-]{1,40}$/.test(id))
          .slice(0, 9)
      : [];

    const frontmatter: Record<string, unknown> = {
      summary: text(body.summary, LIMITS.summary),
      tagline: text(body.tagline, LIMITS.tagline) || undefined,
      featured: featured.length ? featured : undefined,
      metrics: parsed.metrics.length ? parsed.metrics : undefined,
      updated: new Date().toISOString().slice(0, 10),
    };
    for (const key of Object.keys(frontmatter)) {
      if (frontmatter[key] === undefined) delete frontmatter[key];
    }

    const markdown = text(body.markdown, LIMITS.markdown);
    const dir = join(CONTENT_DIR, "countries");
    await mkdir(dir, { recursive: true });
    // gray-matter zapíše YAML samo – ruční skládání frontmatteru se u vnořených
    // seznamů rozbije na první uvozovce.
    await writeFile(
      join(dir, `${country.slug}.md`),
      matter.stringify(markdown ? `\n${markdown}\n` : "\n", frontmatter),
      "utf8",
    );

    revalidatePath(`/country/${country.slug}`);
    revalidatePath("/admin");
    return NextResponse.json({ ok: true, url: `/country/${country.slug}` });
  }

  if (kind === "region") {
    const region = REGION_BY_SLUG[slug];
    if (!region) {
      return NextResponse.json({ error: "Neznámý region." }, { status: 400 });
    }

    const file = join(CONTENT_DIR, "regions", `${region.slug}.json`);
    // Časovou osu, zdroje a FAQ tenhle formulář needituje, takže je načteme
    // a zapíšeme beze změny – jinak by je uložení metrik smazalo.
    let dossier: RegionDossier = {};
    try {
      dossier = JSON.parse(await readFile(file, "utf8")) as RegionDossier;
    } catch {
      dossier = {};
    }

    const intro = text(body.intro, LIMITS.intro);
    const next: RegionDossier = {
      ...dossier,
      intro: intro || undefined,
      metrics: parsed.metrics.length ? parsed.metrics : undefined,
    };
    if (!next.intro) delete next.intro;
    if (!next.metrics) delete next.metrics;

    await mkdir(join(CONTENT_DIR, "regions"), { recursive: true });
    await writeFile(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");

    revalidatePath(`/region/${region.slug}`);
    revalidatePath("/admin");
    return NextResponse.json({ ok: true, url: `/region/${region.slug}` });
  }

  return NextResponse.json({ error: "Neznámý typ profilu." }, { status: 400 });
}

/** Smazání redakčního profilu země; region má vlastní soubor s osou, ten nemažeme. */
export async function DELETE(request: Request) {
  const gate = await requirePermission("regions", "d");
  if ("response" in gate) return gate.response;

  const { searchParams } = new URL(request.url);
  const country = countryBySlug(searchParams.get("slug") ?? "");
  if (!country) {
    return NextResponse.json({ error: "Neznámá země." }, { status: 400 });
  }

  try {
    await unlink(join(CONTENT_DIR, "countries", `${country.slug}.md`));
  } catch {
    return NextResponse.json({ error: "Profil neexistuje." }, { status: 404 });
  }

  revalidatePath(`/country/${country.slug}`);
  revalidatePath("/admin");
  return NextResponse.json({ ok: true });
}
