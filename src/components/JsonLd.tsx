import { jsonLdHtml } from "@/lib/seo";

/** Structured data for search engines; `<` is escaped, so the script can't be terminated. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(data) }} />
  );
}
