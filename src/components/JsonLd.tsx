import { jsonLdHtml } from "@/lib/seo";

/** Strukturovaná data pro vyhledávače; `<` je escapované, takže nejde ukončit script. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(data) }} />
  );
}
