import type { Metadata } from "next";
import Link from "@/components/i18n/Link";
import { JsonLd } from "@/components/JsonLd";
import { TOPICS_PATH } from "@/config/navigation";
import { getEncyclopediaEntries } from "@/features/entries/queries";
import { getAtlas } from "@/features/geography/queries";
import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { cssBackgroundImage } from "@/lib/security/urls";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbNode, graph, itemListNode, pageUrl, webPageNode } from "@/lib/seo/jsonld";

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = await localeFrom(params);
  const t = getMessages(locale).topics;
  return pageMetadata({
    locale,
    path: TOPICS_PATH,
    title: t.metaTitle,
    description: t.description,
  });
}

/** Topics: every encyclopedia dossier as a photo card, full width over the map. */
export default async function TopicsPage({ params }: Params) {
  const locale = await localeFrom(params);
  const t = getMessages(locale).topics;
  const [entries, atlas] = await Promise.all([getEncyclopediaEntries(locale), getAtlas(locale)]);

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-12 pb-4 sm:px-8 sm:pt-16">
        <h1 className="font-display text-[34px] font-bold tracking-tight sm:text-[44px]">
          {t.title}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
          {t.intro}
        </p>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        {entries.length ? (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((item) => {
              const image = cssBackgroundImage(item.hero);
              const region = item.region ? atlas.regionBySlug.get(item.region)?.name : null;
              return (
                <li key={item.slug}>
                  <Link
                    href={`/entry/${item.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
                  >
                    <span
                      aria-hidden
                      className="relative block aspect-[16/10] bg-[var(--color-ink)] bg-cover bg-center"
                      style={image ? { backgroundImage: image } : undefined}
                    >
                      <span className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-80 transition group-hover:opacity-100" />
                    </span>
                    <span className="flex flex-1 flex-col p-5">
                      {region ? (
                        <span className="text-[11px] font-medium tracking-[0.1em] text-[var(--color-ink-muted)] uppercase">
                          {region}
                        </span>
                      ) : null}
                      <span className="font-display mt-1.5 text-[19px] leading-snug font-bold group-hover:text-[var(--color-accent)]">
                        {item.title}
                      </span>
                      <span className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-[var(--color-ink-soft)]">
                        {item.summary}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[14px] text-[var(--color-ink-muted)]">{t.empty}</p>
        )}
      </div>

      <JsonLd
        data={graph(
          webPageNode({
            url: pageUrl(TOPICS_PATH, locale),
            name: t.title,
            description: t.description,
            locale,
            type: "CollectionPage",
            breadcrumb: breadcrumbNode(
              [
                { name: "Atlas of Today's World", path: "/" },
                { name: t.title, path: TOPICS_PATH },
              ],
              locale,
            ),
          }),
          itemListNode(
            t.title,
            entries.map((item) => ({
              name: item.title,
              url: pageUrl(`/entry/${item.slug}`, locale),
            })),
          ),
        )}
      />
    </>
  );
}
