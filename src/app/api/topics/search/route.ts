import { NextResponse } from "next/server";
import { getTopicTexts } from "@/features/topics/queries";
import { searchTopicTexts } from "@/features/topics/text-search";
import { allowRequest } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/** Full-text search inside the topics (chapters and introductions) for the Topics page. */
export async function GET(request: Request) {
  if (!(await allowRequest("topic-search", request.headers, { limit: 60, windowSeconds: 60 }))) {
    return NextResponse.json(
      { error: "Too many searches. Try again in a minute." },
      { status: 429 },
    );
  }

  const query = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 200);
  const results = searchTopicTexts(await getTopicTexts(), query);
  return NextResponse.json({ query, results });
}
