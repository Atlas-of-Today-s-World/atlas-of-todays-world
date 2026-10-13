import { search, SEARCH_LIMIT } from "@/lib/search";
import { searchResponse } from "@/lib/search-response";

export const dynamic = "force-dynamic";

/**
 * Full-text search across all of Atlas: regions, countries, global issues and
 * news. Cached on the CDN per URL (lib/search-response.ts).
 */
export async function GET(request: Request) {
  return searchResponse(request, "search", SEARCH_LIMIT, (query, params) => {
    const requested = Number(params.get("limit") ?? 12);
    const limit = Number.isFinite(requested)
      ? Math.min(Math.max(Math.trunc(requested), 1), 40)
      : 12;
    return search(query, limit);
  });
}
