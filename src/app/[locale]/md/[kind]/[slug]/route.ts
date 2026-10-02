import { getEncyclopediaEntries, getEntries } from "@/features/entries/queries";
import { isLocale, LOCALES } from "@/features/i18n/config";
import { articleMarkdown, articleUrl } from "@/features/seo/documents";
import { getArticle } from "@/features/seo/queries";
import { machineResponse } from "@/lib/seo/response";

/**
 * Markdown version of an article (llms.txt convention): `/news/<slug>.md`,
 * `/cs/entry/<slug>.md` — the proxy rewrites those URLs here. The HTML page
 * stays the canonical one (Link header), so search engines don't index a copy.
 */
export const revalidate = 3600;

/** Every published article in every language; new ones are rendered on first request. */
export async function generateStaticParams() {
  const [news, entries] = await Promise.all([getEntries(), getEncyclopediaEntries()]);
  return LOCALES.flatMap((locale) => [
    ...news.map((item) => ({ locale, kind: "news", slug: item.slug })),
    ...entries.map((item) => ({ locale, kind: "entry", slug: item.slug })),
  ]);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; kind: string; slug: string }> },
) {
  const { locale, kind, slug } = await params;
  if (!isLocale(locale) || (kind !== "news" && kind !== "entry") || !/^[a-z0-9-]+$/.test(slug)) {
    return new Response("Not found", { status: 404 });
  }
  const article = await getArticle(kind, slug, locale);
  if (!article) return new Response("Not found", { status: 404 });
  return machineResponse(articleMarkdown(kind, article.item, article.atlas), "markdown", {
    link: `<${articleUrl(kind, article.item)}>; rel="canonical"`,
  });
}
