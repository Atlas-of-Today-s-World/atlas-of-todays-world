import { NextResponse } from "next/server";
import { search } from "@/lib/search";

export const dynamic = "force-dynamic";

/** Fulltext nad celým Atlasem: regiony, země i novinky. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const limit = Number(searchParams.get("limit") ?? 12);

  const results = await search(query, Number.isFinite(limit) ? limit : 12);
  return NextResponse.json({ query, results });
}
