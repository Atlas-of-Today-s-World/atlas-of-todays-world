import { getSiteSettings } from "@/features/site/queries";
import Link from "@/components/i18n/Link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { getEntries } from "@/features/entries/queries";
import { getAtlas } from "@/features/geography/queries";
import { format } from "@/lib/i18n/messages";
import { getMessagesFor, localeFrom } from "@/lib/i18n/request";
import { JsonLd } from "@/components/JsonLd";
import { staticPageMetadata } from "@/features/seo/metadata";
import { breadcrumbNode, graph, itemListNode, pageUrl, webPageNode } from "@/features/seo/jsonld";
import { categoryLabel, NEWS_CATEGORIES } from "@/lib/content-types";
import { routes } from "@/config/routes";

export const generateMetadata = staticPageMetadata("newsIndex", routes.newsIndex);

export default async function NewsIndexPage({ params }: PageProps<"/[locale]/news">) {
  const locale = await localeFrom(params);
  const messages = await getMessagesFor(locale);
  const t = messages.newsIndex;
  const [newsItems, atlas] = await Promise.all([getEntries(), getAtlas(locale)]);
  const site = await getSiteSettings();

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
            <h2 className="font-display text-[18px] font-bold">
              {categoryLabel(category, messages)}
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {group.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={routes.news(item.slug)}
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
            url: pageUrl(routes.newsIndex, locale),
            name: t.heading,
            description: t.description,
            locale,
            type: "CollectionPage",
            breadcrumb: breadcrumbNode(site, [{ name: t.heading, path: routes.newsIndex }], locale),
          }),
          itemListNode(
            t.heading,
            newsItems.map((item) => ({
              name: item.title,
              // The canonical URL: this language if the item exists in it, else its original.
              url: pageUrl(
                routes.news(item.slug),
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
              href={routes.region(region.slug)}
              className={cn(buttonVariants({ variant: "outline", size: "chip" }), "text-[13px]")}
            >
              {region.name}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
