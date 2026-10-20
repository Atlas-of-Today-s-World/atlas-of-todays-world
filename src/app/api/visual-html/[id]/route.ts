import { getVisualHtml } from "@/features/visuals/html-query";
import { SITE_URL } from "@/lib/site";
import { visualHtmlDocument, visualHtmlHeaderEntries } from "@/lib/visual-html";

const dev = process.env.NODE_ENV !== "production";

const NOT_FOUND = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Not available</title></head><body><p style="font:14px system-ui,sans-serif;color:#5d6370;text-align:center;margin:40px 16px">This chart is not available.</p></body></html>`;

/**
 * An editor's custom code from Maps & charts (ADR-032), as a document of its
 * own: sandboxed by its CSP into an opaque origin and framed only by our
 * pages (lib/visual-html.ts). Rendered per request: frame-ancestors names the
 * origin the request came to (production, a preview deployment, a domain in
 * front) besides the configured one — on Vercel a route's own headers win
 * over the proxy's. The code itself comes from the data cache under the
 * visual's tag, which a save or a removal updates.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const visual = await getVisualHtml(id);
  const origins = [new URL(request.url).origin, new URL(SITE_URL).origin];
  return new Response(visual ? visualHtmlDocument(visual.html, visual.title) : NOT_FOUND, {
    status: visual ? 200 : 404,
    headers: [
      ["Content-Type", "text/html; charset=utf-8"],
      ["Cache-Control", "private, no-cache"],
      ...visualHtmlHeaderEntries({ dev, origins }),
    ],
  });
}
