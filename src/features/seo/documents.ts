import type { Encyclopedia, Entry } from "@/features/entries/types";
import type { Atlas } from "@/features/geography/types";
import { localePath } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages";
import { ORGANIZATION } from "@/config/organization";
import { absoluteUrl } from "@/lib/seo";
import { htmlToMarkdown } from "@/lib/seo/markdown";
import { categoryLabel, type ArticleKind } from "@/lib/content-types";
import type { LlmsDocument } from "@/lib/seo/llms";
import { routes } from "@/config/routes";

/**
 * Articles as Markdown documents (answer-first: summary, key facts, then the
 * text, questions and sources) — the `.md` versions of articles and the body
 * of llms-full.txt. The URL, dates and author come first so a quoting engine
 * has everything it needs to cite the page.
 */

const pathOf = (kind: ArticleKind, slug: string) => routes.article(kind, slug);

/** Canonical URL of the article in the language its text is in. */
export const articleUrl = (kind: ArticleKind, item: Entry) =>
  absoluteUrl(localePath(item.locale, pathOf(kind, item.slug)));

function facts(item: Entry, atlas: Atlas, messages: Messages, publisher: string): string[] {
  const t = messages.seo;
  const region = item.region ? atlas.regionBySlug.get(item.region) : undefined;
  const countries = item.countries
    .map((iso3) => atlas.countryByIso3.get(iso3)?.name)
    .filter(Boolean)
    .join(", ");
  const author = item.authorSlug
    ? `${item.author} (${absoluteUrl(routes.author(item.authorSlug))})`
    : (item.author ?? messages.article.editorialTeam);
  return [
    item.published ? `${t.published}: ${item.published}` : "",
    item.updated ? `${t.updated}: ${item.updated}` : "",
    `${t.author}: ${author}`,
    `${t.category}: ${categoryLabel(item.category, messages)}`,
    region ? `${t.region}: ${region.name}` : "",
    countries ? `${t.countries}: ${countries}` : "",
    `${t.publisher}: ${publisher} (${absoluteUrl("/")})`,
  ].filter(Boolean);
}

const isEncyclopedia = (item: Entry): item is Encyclopedia => "chapters" in item;

/** Body of an article in Markdown (without the title). */
function body(item: Entry, t: Messages["article"]): string {
  const parts: string[] = [];
  if (item.summary) parts.push(item.summary);
  if (isEncyclopedia(item)) {
    if (item.seo.geoSummary) parts.push(`## ${t.inShort}\n\n${item.seo.geoSummary}`);
    if (item.summaryPoints.length)
      parts.push(
        `## ${t.summary}\n\n${item.summaryPoints.map((point) => `- ${point}`).join("\n")}`,
      );
  }
  if (item.html) parts.push(htmlToMarkdown(item.html));
  if (isEncyclopedia(item)) {
    item.chapters.forEach((chapter, index) => {
      parts.push(
        [
          `## ${t.topic.replace("{number}", String(index + 1))}: ${chapter.title}`,
          chapter.overview.trim(),
          chapter.summaryPoints.map((point) => `- ${point}`).join("\n"),
          htmlToMarkdown(chapter.html),
        ]
          .filter(Boolean)
          .join("\n\n"),
      );
    });
    if (item.faq.length)
      parts.push(
        `## ${t.faq}\n\n${item.faq.map((faq) => `### ${faq.question}\n\n${faq.answer}`).join("\n\n")}`,
      );
    const sources = item.tiles.flatMap((tile) => tile.resources);
    if (sources.length)
      parts.push(
        `## ${t.sources}\n\n${sources
          .map(
            (source) =>
              `- [${source.title}](${source.url})${source.source ? ` — ${source.source}` : ""}`,
          )
          .join("\n")}`,
      );
    if (item.authorProfile?.bio)
      parts.push(
        `## ${t.aboutAuthor.replace("{name}", item.authorProfile.name)}\n\n${item.authorProfile.bio}`,
      );
    if (item.authorProfile?.worksHtml)
      parts.push(`### ${t.selectedWorks}\n\n${htmlToMarkdown(item.authorProfile.worksHtml)}`);
  }
  return parts.join("\n\n");
}

/**
 * Article as an llms-full.txt document (title, URL and facts, body). Labels
 * follow the language of the text, so an untranslated original stays one
 * language: `messages` are the UI texts in `item.locale` (`getMessagesFor`).
 */
export function articleDocument(
  kind: ArticleKind,
  item: Entry,
  atlas: Atlas,
  messages: Messages,
  publisher: string = ORGANIZATION.name,
): LlmsDocument {
  return {
    title: item.title,
    url: articleUrl(kind, item),
    facts: facts(item, atlas, messages, publisher),
    markdown: body(item, messages.article),
  };
}

/** The `.md` version of an article: title, facts as a list, body. */
export function articleMarkdown(
  kind: ArticleKind,
  item: Entry,
  atlas: Atlas,
  messages: Messages,
  publisher: string = ORGANIZATION.name,
): string {
  const doc = articleDocument(kind, item, atlas, messages, publisher);
  return `# ${doc.title}\n\n${[`URL: ${doc.url}`, ...doc.facts].map((fact) => `- ${fact}`).join("\n")}\n\n${doc.markdown}\n`;
}
