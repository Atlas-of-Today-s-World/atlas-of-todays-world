import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/i18n/Link";
import { JsonLd } from "@/components/JsonLd";
import { getAuthorBySlug, getAuthors } from "@/features/authors/queries";
import { getArticlesByAuthor } from "@/features/entries/queries";
import { format, getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { formatLongDate } from "@/lib/format";
import { cssBackgroundImage } from "@/lib/security/urls";
import { PHOTO_WIDTH } from "@/lib/images";
import { pageMetadata } from "@/lib/seo/metadata";
import {
  breadcrumbNode,
  graph,
  ids,
  itemListNode,
  pageUrl,
  personNode,
  webPageNode,
} from "@/lib/seo/jsonld";
import { routes } from "@/config/routes";

/**
 * Public author profile (G8): who writes the Atlas and from what position,
 * with all their articles — the page bylines and Person structured data link to.
 */
type Params = { params: Promise<{ locale: string; slug: string }> };

export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getAuthors()).map((author) => ({ slug: author.slug }));
}

/** The author's published news and entries, newest first, with their page path. */
async function articlesOf(slug: string) {
  return (await getArticlesByAuthor(slug)).map((item) => ({
    ...item,
    path: routes.article(item.kind, item.slug),
  }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const locale = await localeFrom(params);
  const author = await getAuthorBySlug(slug);
  if (!author) return {};
  const t = getMessages(locale).authorPage;
  const articles = await articlesOf(slug);
  return pageMetadata({
    locale,
    path: routes.author(slug),
    title: author.name,
    description: author.bio || format(t.description, { name: author.name }),
    image: author.photo,
    type: "profile",
    // A profile without published articles is thin: reachable, not indexed.
    noindex: !articles.length,
  });
}

export default async function AuthorPage({ params }: Params) {
  const { slug } = await params;
  const locale = await localeFrom(params);
  const author = await getAuthorBySlug(slug);
  if (!author) notFound();
  const messages = getMessages(locale);
  const t = messages.authorPage;
  const articles = await articlesOf(slug);
  const photo = cssBackgroundImage(author.photo, PHOTO_WIDTH.avatar);
  const url = pageUrl(routes.author(slug), locale);

  return (
    <main className="max-w-2xl">
      <p className="text-[11px] font-medium tracking-[0.1em] text-[var(--color-ink-muted)] uppercase">
        {t.kicker}
      </p>
      <div className="mt-3 flex items-center gap-5">
        {photo ? (
          <span
            role="img"
            aria-label={format(messages.article.photoOf, { name: author.name })}
            className="size-20 shrink-0 rounded-full bg-cover bg-center"
            style={{ backgroundImage: photo }}
          />
        ) : null}
        <h1 className="font-display text-[34px] leading-tight font-bold">{author.name}</h1>
      </div>

      <div className="prose-atlas mt-6">
        <p className="whitespace-pre-line">
          {author.bio || format(t.description, { name: author.name })}
        </p>
        {author.positionality ? (
          <>
            <h2>{messages.article.positionality}</h2>
            <p className="whitespace-pre-line">{author.positionality}</p>
          </>
        ) : null}
      </div>

      <section aria-labelledby="author-articles" className="mt-10">
        <h2 id="author-articles" className="font-display text-[18px] font-bold">
          {format(t.articles, { name: author.name })}
        </h2>
        {articles.length ? (
          <ul className="mt-4 divide-y divide-[var(--color-line)]">
            {articles.map((item) => (
              <li key={item.path} className="py-3">
                <Link
                  href={item.path}
                  className="font-display block text-[15px] font-bold hover:text-[var(--color-accent)]"
                >
                  {item.title}
                </Link>
                <span className="mt-1 block text-[12.5px] text-[var(--color-ink-muted)]">
                  {messages.categories[item.category]}
                  {item.published ? (
                    <>
                      {" · "}
                      <time dateTime={item.published}>
                        {formatLongDate(item.published, locale)}
                      </time>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[14px] text-[var(--color-ink-soft)]">{t.none}</p>
        )}
      </section>

      <JsonLd
        data={graph(
          webPageNode({
            url,
            name: author.name,
            description: author.bio,
            locale,
            type: "ProfilePage",
            about: ids.author(slug),
            breadcrumb: breadcrumbNode(
              [
                { name: "Atlas of Today's World", path: "/" },
                { name: messages.about.title, path: routes.about },
                { name: author.name, path: routes.author(slug) },
              ],
              locale,
            ),
          }),
          personNode({
            slug,
            name: author.name,
            description: author.bio,
            image: author.photo,
            knowsAbout: [...new Set(articles.map((item) => messages.categories[item.category]))],
          }),
          articles.length
            ? itemListNode(
                format(t.articles, { name: author.name }),
                articles.map((item) => ({ name: item.title, url: pageUrl(item.path, locale) })),
              )
            : undefined,
        )}
      />
    </main>
  );
}
