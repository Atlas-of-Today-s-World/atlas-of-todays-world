import { getVisualHtml } from "@/features/visuals/html-query";
import { SITE_URL } from "@/lib/site";
import { visualHtmlDocument, visualHtmlHeaderEntries } from "@/lib/visual-html";

/** Same as PUBLIC_REVALIDATE_SECONDS (segment config must be a literal). */
export const revalidate = 3600;

/** Nothing prerendered: each visual's answer is rendered on first request, then cached (ISR). */
export function generateStaticParams(): { id: string }[] {
  return [];
}

/**
 * The proxy sets these headers on every answer, with the origin the request
 * came to (its headers win); these, with the configured site's origin, are
 * the fallback. The request itself isn't read: the answer stays cacheable.
 */
const HEADERS = visualHtmlHeaderEntries({
  dev: process.env.NODE_ENV !== "production",
  origins: [new URL(SITE_URL).origin],
});

const NOT_FOUND = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Not available</title></head><body><p style="font:14px system-ui,sans-serif;color:#5d6370;text-align:center;margin:40px 16px">This chart is not available.</p></body></html>`;

/**
 * An editor's custom code from Maps & charts (ADR-032), as a document of its
 * own: sandboxed by its CSP into an opaque origin and framed only by our
 * pages (lib/visual-html.ts). Cached like the pages; saving or removing the
 * visual updates its tag.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const visual = await getVisualHtml(id);
  return new Response(visual ? visualHtmlDocument(visual.html, visual.title) : NOT_FOUND, {
    status: visual ? 200 : 404,
    headers: [["Content-Type", "text/html; charset=utf-8"], ...HEADERS],
  });
}
