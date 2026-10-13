import "server-only";
import { NextResponse } from "next/server";
import { normalizeSearchQuery } from "@/lib/search-query";
import { allowRequest } from "@/lib/security/rate-limit";

/**
 * A found answer: never kept by the browser (an edit shows on the next
 * search), five minutes on the CDN, then served stale for up to an hour
 * while one request refreshes it. The CDN keys it by the whole URL, which
 * is why the callers send the query normalised.
 */
const SEARCH_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0",
  "CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
} as const;

/** Rate-limited and failed answers are never cached anywhere. */
const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * GET handler body of a search endpoint (`?q=` → `{ query, results }`). The
 * rate limit stays here: it counts only the requests the CDN didn't answer.
 */
export async function searchResponse<T>(
  request: Request,
  scope: string,
  limits: { limit: number; windowSeconds: number },
  find: (query: string, params: URLSearchParams) => Promise<T[]>,
): Promise<NextResponse> {
  if (!(await allowRequest(scope, request.headers, limits))) {
    return NextResponse.json(
      { error: "Too many searches. Try again in a minute." },
      { status: 429, headers: NO_STORE },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = normalizeSearchQuery(searchParams.get("q") ?? "");
  try {
    const results = await find(query, searchParams);
    return NextResponse.json({ query, results }, { headers: SEARCH_CACHE_HEADERS });
  } catch (error) {
    console.error(`[${scope}]`, error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Search failed. Try again." },
      { status: 500, headers: NO_STORE },
    );
  }
}
