import { indexNowKey } from "@/lib/seo/indexnow";

/**
 * IndexNow key file (keyLocation in every submission, ADR-021). The key is
 * public by design — it only proves the submitter controls this host.
 * Without INDEXNOW_KEY the feature is off and this returns 404.
 */
export const dynamic = "force-static";

export function GET() {
  const key = indexNowKey();
  if (!key) return new Response("Not found", { status: 404 });
  return new Response(key, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
