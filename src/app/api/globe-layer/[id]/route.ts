import { NextResponse } from "next/server";
import { globeLayer } from "@/features/geography/globe-layer";
import { getAtlas, getIndicator } from "@/features/geography/queries";
import { DEFAULT_LOCALE } from "@/features/i18n/config";

/** Same as PUBLIC_REVALIDATE_SECONDS (segment config must be a literal). */
export const revalidate = 3600;

/** Every current layer prerendered; a layer added later is rendered on first request. */
export async function generateStaticParams() {
  const atlas = await getAtlas(DEFAULT_LOCALE);
  return atlas.indicators.map((indicator) => ({ id: indicator.id }));
}

/**
 * One data layer of the globe (colours and hover values per country), fetched
 * when a visitor switches the layer on. Static and cached like the pages; an
 * edit invalidates it through the same cache tags (`atlas` for the layer's
 * definition and the map theme, the layer's own tag for its values).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [atlas, indicator] = await Promise.all([getAtlas(DEFAULT_LOCALE), getIndicator(id)]);
  if (!indicator) return NextResponse.json({ error: "Unknown layer." }, { status: 404 });
  return NextResponse.json(globeLayer(indicator, atlas.theme.saturation, DEFAULT_LOCALE));
}
