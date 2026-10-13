import { searchTopics } from "@/features/topics/queries";
import { searchResponse } from "@/lib/search-response";

export const dynamic = "force-dynamic";

/**
 * Full-text search inside the topics (chapters and introductions) for the
 * Topics page. Cached on the CDN per URL (lib/search-response.ts).
 */
export async function GET(request: Request) {
  return searchResponse(request, "topic-search", { limit: 60, windowSeconds: 60 }, (query) =>
    searchTopics(query),
  );
}
