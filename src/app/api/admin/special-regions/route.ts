import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  allSpecialRegions,
  saveSpecialRegions,
  type SpecialRegion,
} from "@/lib/special-regions";

export const dynamic = "force-dynamic";

/**
 * Správa vlastních („special") regionů z administrace.
 *
 * MOCK: bez autentizace, zapisuje do src/content/special-regions.json, takže
 * běží jen lokálně. Pro ostrý provoz sem patří redakční systém s účty.
 */
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Střed celku = průměr souřadnic členských zemí. */
function centerOf(
  countries: { lon: number | null; lat: number | null }[],
): [number, number] {
  const points = countries.filter(
    (c): c is { lon: number; lat: number } => c.lon !== null && c.lat !== null,
  );
  if (!points.length) return [14, 49.5];
  const lon = points.reduce((sum, p) => sum + p.lon, 0) / points.length;
  const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  return [Number(lon.toFixed(2)), Number(lat.toFixed(2))];
}

function revalidateAll(slug?: string) {
  revalidatePath("/");
  revalidatePath("/admin");
  if (slug) revalidatePath(`/special/${slug}`);
}

export async function GET() {
  return NextResponse.json({ regions: await allSpecialRegions() });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neplatný JSON." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const countries = Array.isArray(body.countries)
    ? [...new Set(body.countries.map(String).filter((iso) => /^[A-Z]{3}$/.test(iso)))]
    : [];

  if (!name) {
    return NextResponse.json({ error: "Doplň název celku." }, { status: 400 });
  }
  if (countries.length < 2) {
    return NextResponse.json(
      { error: "Vyber aspoň dvě země." },
      { status: 400 },
    );
  }

  const existing = await allSpecialRegions();
  const slug = slugify(String(body.slug ?? "").trim() || name);
  if (!slug) {
    return NextResponse.json({ error: "Z názvu nejde odvodit URL." }, { status: 400 });
  }

  // Souřadnice členů posílá klient, ať server nemusí sahat do číselníku.
  const points = Array.isArray(body.points)
    ? (body.points as { lon: number | null; lat: number | null }[])
    : [];

  const region: SpecialRegion = {
    slug,
    name,
    subtitle: String(body.subtitle ?? "").trim() || "Custom grouping",
    summary: String(body.summary ?? "").trim(),
    fill: /^#[0-9a-f]{6}$/i.test(String(body.fill)) ? String(body.fill) : "#A8C8E8",
    stroke: /^#[0-9a-f]{6}$/i.test(String(body.stroke))
      ? String(body.stroke)
      : "#3E7AA8",
    center: centerOf(points),
    zoom: 2.6,
    countries,
  };

  // Stejný slug = úprava existujícího celku.
  const index = existing.findIndex((item) => item.slug === slug);
  const next = [...existing];
  if (index >= 0) next[index] = { ...existing[index], ...region };
  else next.push(region);

  await saveSpecialRegions(next);
  revalidateAll(slug);

  return NextResponse.json({ ok: true, slug, url: `/special/${slug}` });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = slugify(searchParams.get("slug") ?? "");
  if (!slug) return NextResponse.json({ error: "Chybí slug." }, { status: 400 });

  const existing = await allSpecialRegions();
  if (!existing.some((region) => region.slug === slug)) {
    return NextResponse.json({ error: "Celek neexistuje." }, { status: 404 });
  }

  await saveSpecialRegions(existing.filter((region) => region.slug !== slug));
  revalidateAll(slug);

  return NextResponse.json({ ok: true });
}
