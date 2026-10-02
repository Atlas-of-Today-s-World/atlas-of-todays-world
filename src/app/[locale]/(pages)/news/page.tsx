import type { Metadata } from "next";
import Link from "@/components/i18n/Link";
import { getEntries } from "@/features/entries/queries";
import { getAtlas } from "@/features/geography/queries";
import { format, getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { JsonLd } from "@/components/JsonLd";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbNode, graph, itemListNode, pageUrl, webPageNode } from "@/lib/seo/jsonld";
import { NEWS_CATEGORIES } from "@/lib/content-types";

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = await localeFrom(params);
  const t = getMessages(locale).newsIndex;
  return pageMetadata({ locale, path: "/news", title: t.title, description: t.description });
}

export default async function NewsIndexPage({ params }: Params) {
  const locale = await localeFrom(params);
  const messages = getMessages(locale);
  const t = messages.newsIndex;
  const [newsItems, atlas] = await Promise.all([getEntries(locale), getAtlas(locale)]);

  return (
    <main>
      <h1 className="font-display text-[34px] font-bold">{t.heading}</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
        {t.intro} {format(t.count, { count: String(newsItems.length) })}
      </p>

      {NEWS_CATEGORIES.map((category) => {
        const group = newsItems.filter((item) => item.category === category);
        if (!group.length) return null;
        return (
          <section key={category} className="mt-10">
            <h2 className="font-display text-[18px] font-bold">{messages.categories[category]}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {group.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/news/${item.slug}`}
                    className="group block h-full rounded-xl border border-[var(--color-line)] p-4 transition hover:border-[var(--color-accent)]"
                  >
                    <span className="text-[11px] tracking-wide text-[var(--color-ink-muted)] uppercase">
                      {item.region ? atlas.regionBySlug.get(item.region)?.name : null}
                      {item.issue ? (
                        <>
                          {" · "}
                          <span className="text-[var(--color-link)]">
                            {atlas.issueBySlug.get(item.issue)?.name ?? item.issue}
                          </span>
                        </>
                      ) : null}
                    </span>
                    <span className="font-display mt-1 block text-[15px] font-bold group-hover:text-[var(--color-accent)]">
                      {item.title}
                    </span>
                    <span className="mt-1.5 block text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
                      {item.summary}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <JsonLd
        data={graph(
          webPageNode({
            url: pageUrl("/news", locale),
            name: t.heading,
            description: t.description,
            locale,
            type: "CollectionPage",
            breadcrumb: breadcrumbNode(
              [
                { name: "Atlas of Today's World", path: "/" },
                { name: t.heading, path: "/news" },
              ],
              locale,
            ),
          }),
          itemListNode(
            t.heading,
            newsItems.map((item) => ({
              name: item.title,
              // The canonical URL: this language if the item exists in it, else its original.
              url: pageUrl(
                `/news/${item.slug}`,
                item.languages.includes(locale) ? locale : (item.languages[0] ?? locale),
              ),
            })),
          ),
        )}
      />

      <section className="mt-12 border-t border-[var(--color-line)] pt-8">
        <h2 className="font-display text-[18px] font-bold">{t.byRegion}</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {atlas.regions.map((region) => (
            <Link
              key={region.slug}
              href={`/region/${region.slug}`}
              className="rounded-full border border-[var(--color-line)] px-3.5 py-1.5 text-[13px] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              {region.name}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
