import { NextResponse } from "next/server";
import { search } from "@/lib/search";
import { allowRequest } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/** Full-text search across all of Atlas: regions, countries, global issues and news. */
export async function GET(request: Request) {
  if (!(await allowRequest("search", request.headers, { limit: 60, windowSeconds: 60 }))) {
    return NextResponse.json(
      { error: "Too many searches. Try again in a minute." },
      { status: 429 },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").slice(0, 200);
  const requested = Number(searchParams.get("limit") ?? 12);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 40) : 12;

  const results = await search(query, limit);
  return NextResponse.json({ query, results });
}
