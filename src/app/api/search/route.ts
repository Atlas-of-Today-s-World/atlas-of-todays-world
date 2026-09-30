import { NextResponse } from "next/server";
import { search } from "@/lib/search";

export const dynamic = "force-dynamic";

/** Fulltext nad celým Atlasem: regiony, země i novinky. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const requested = Number(searchParams.get("limit") ?? 12);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 40) : 12;

  const results = await search(query.slice(0, 200), limit);
  return NextResponse.json({ query, results });
}
