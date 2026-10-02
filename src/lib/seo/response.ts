/**
 * Responses of the machine-readable files (sitemaps, feeds, llms.txt, .md).
 * Caching comes from the route's ISR `revalidate` and the data cache tags.
 */
export const MACHINE_TYPES = {
  xml: "application/xml; charset=utf-8",
  rss: "application/rss+xml; charset=utf-8",
  atom: "application/atom+xml; charset=utf-8",
  text: "text/plain; charset=utf-8",
  markdown: "text/markdown; charset=utf-8",
} as const;

export function machineResponse(
  body: string,
  type: keyof typeof MACHINE_TYPES,
  headers: Record<string, string> = {},
): Response {
  return new Response(body, {
    headers: {
      "content-type": MACHINE_TYPES[type],
      ...headers,
    },
  });
}
