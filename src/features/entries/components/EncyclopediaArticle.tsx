import { ChevronDown } from "lucide-react";
import { SafeHtml } from "@/components/atlas/SafeHtml";
import { FaqList } from "@/components/portrait/sections";
import type { Atlas } from "@/features/geography/types";
import { format } from "@/features/i18n/messages";
import { getRequestLocale, getT } from "@/features/i18n/request";
import { formatLongDate } from "@/lib/format";
import { cssBackgroundImage, safeUrl } from "@/lib/security/urls";
import type { Encyclopedia, EntryAuthor, EntryChapter as Chapter, LearnMoreTile } from "../queries";
import { ArticleFrame, META_LINE, PlaceLinks } from "./ArticleFrame";
import { DossierExplorer } from "./DossierExplorer";
import { OpenOnHash } from "./OpenOnHash";

const AUTHOR_ID = "about-the-author";
/** Panel ids double as URL hashes: `#topic-2`, `#learn-videos`. */
const topicId = (index: number) => `topic-${index + 1}`;
const tileId = (tile: LearnMoreTile) => `learn-${tile.slug}`;

/** Collapsible `<summary>` bar (44 px target); the arrow rotates with the state. */
const SUMMARY =
  "flex min-h-11 cursor-pointer list-none items-center gap-2 text-[13px] font-medium text-[var(--color-link)] [&::-webkit-details-marker]:hidden";
const CHEVRON = "size-4 transition-transform group-open:rotate-180";
const LABEL = "text-[11px] font-medium tracking-[0.1em] text-[var(--color-ink-muted)] uppercase";

/**
 * Encyclopedia entry presented as a dossier, for the public page and preview:
 * header with author and summary, then topic tiles and "Learn more" tiles
 * side by side (each opens its panel), FAQ and the author's bio.
 */
export function EncyclopediaArticle({
  item,
  atlas,
  banner,
}: {
  item: Encyclopedia;
  atlas: Atlas;
  /** Bar above the article (preview: status and link validity). */
  banner?: React.ReactNode;
}) {
  return (
    <ArticleFrame
      item={item}
      atlas={atlas}
      banner={banner}
      heroCaption={item.heroCredit}
      lang={item.locale}
    >
      <EntryHeader item={item} atlas={atlas} />

      {item.html ? <SafeHtml className="prose-atlas mt-7" html={item.html} /> : null}

      <DossierExplorer
        topics={item.chapters.map((chapter, index) => ({
          id: topicId(index),
          title: chapter.title,
          image: chapter.illustration,
        }))}
        tiles={item.tiles.map((tile) => ({
          id: tileId(tile),
          label: tile.label,
          description: tile.description,
          icon: tile.icon,
          image: tile.image,
          count: tile.resources.length,
          empty: !tile.resources.length && !tile.notesHtml,
        }))}
        panels={Object.fromEntries([
          ...item.chapters.map((chapter, index) => [
            topicId(index),
            <TopicPanel key={topicId(index)} chapter={chapter} index={index} />,
          ]),
          ...item.tiles
            .filter((tile) => tile.resources.length || tile.notesHtml)
            .map((tile) => [tileId(tile), <TilePanel key={tile.id} tile={tile} />]),
        ])}
      />

      {item.faq.length ? (
        <div className="-mx-6 mt-10 sm:-mx-10">
          <FaqList items={item.faq} />
        </div>
      ) : null}

      {item.authorProfile ? <AuthorBio author={item.authorProfile} /> : null}
      <OpenOnHash />
    </ArticleFrame>
  );
}

/** Author with photo (click scrolls to the bio), dates and summary bullets. */
function EntryHeader({ item, atlas }: { item: Encyclopedia; atlas: Atlas }) {
  const t = getT().article;
  const locale = getRequestLocale();
  const author = item.authorProfile;
  const photo = cssBackgroundImage(author?.photo);
  return (
    <>
      <p className={META_LINE}>
        <PlaceLinks item={item} atlas={atlas} />
        {item.readingMinutes ? (
          <span>{format(t.minRead, { minutes: String(item.readingMinutes) })}</span>
        ) : null}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {author ? (
          <a
            href={`#${AUTHOR_ID}`}
            className="flex min-h-11 items-center gap-3 rounded-full pr-3 transition hover:bg-[var(--color-line)]/30"
          >
            {photo ? (
              <span
                role="img"
                aria-label={format(t.photoOf, { name: author.name })}
                className="size-11 shrink-0 rounded-full bg-cover bg-center"
                style={{ backgroundImage: photo }}
              />
            ) : null}
            <span className="text-[13px] font-medium text-[var(--color-ink)]">
              {format(t.by, { author: author.name })}
            </span>
          </a>
        ) : item.author ? (
          <span className="text-[13px] font-medium text-[var(--color-ink)]">
            {format(t.by, { author: item.author })}
          </span>
        ) : null}
        <dl className="ml-auto grid grid-cols-[auto_auto] gap-x-2 text-[11.5px] text-[var(--color-ink-muted)]">
          {item.published ? (
            <>
              <dt>{t.published}</dt>
              <dd>
                <time dateTime={item.published}>{formatLongDate(item.published, locale)}</time>
              </dd>
            </>
          ) : null}
          {item.updated && item.updated !== item.published ? (
            <>
              <dt>{t.updated}</dt>
              <dd>
                <time dateTime={item.updated}>{formatLongDate(item.updated, locale)}</time>
              </dd>
            </>
          ) : null}
        </dl>
      </div>

      {item.seo.geoSummary ? (
        <section aria-label={t.inShort} className="mt-6">
          <p className={LABEL}>{t.inShort}</p>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-[var(--color-ink)]">
            {item.seo.geoSummary}
          </p>
        </section>
      ) : null}

      {item.summaryPoints.length ? (
        <section aria-label={t.summary} className="mt-6 rounded-xl bg-[var(--color-line)]/25 p-4">
          <ul className="list-disc space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-[var(--color-ink)]">
            {item.summaryPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

/**
 * Chapter audio version, only when the track exists. It doesn't autoplay (preload none)
 * and the text alternative is the chapter's full text below the player.
 */
function EntryAudio({ src, title }: { src?: string; title: string }) {
  const t = getT().article;
  const url = safeUrl(src);
  if (!url) return null;
  return (
    <figure className="mt-4">
      <figcaption className={LABEL}>{t.listen}</figcaption>
      <audio
        controls
        preload="none"
        src={url}
        aria-label={format(t.audioLabel, { title })}
        className="mt-2 w-full"
      >
        <a href={url}>{t.downloadAudio}</a>
      </audio>
      <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">{t.transcript}</p>
    </figure>
  );
}

/** Topic panel: illustration, title, summary, audio and the full text. */
function TopicPanel({ chapter, index }: { chapter: Chapter; index: number }) {
  const t = getT().article;
  const id = topicId(index);
  const illustration = cssBackgroundImage(chapter.illustration);
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="mt-8 border-t border-[var(--color-line)] pt-7"
    >
      {illustration ? (
        <figure className="m-0">
          <div
            className="h-44 w-full rounded-xl bg-cover bg-center"
            style={{ backgroundImage: illustration }}
            role="img"
            aria-label={chapter.title}
          />
          {chapter.illustrationCredit ? (
            <figcaption className="mt-1 text-right text-[10.5px] text-[var(--color-ink-muted)]">
              {chapter.illustrationCredit}
            </figcaption>
          ) : null}
        </figure>
      ) : null}
      <p className={`mt-5 ${LABEL}`}>{format(t.topic, { number: String(index + 1) })}</p>
      <h2
        id={`${id}-title`}
        className="font-display mt-1 text-[22px] leading-snug font-bold text-[var(--color-ink)]"
      >
        {chapter.title}
      </h2>
      {chapter.summaryPoints.length ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[13.5px] leading-relaxed text-[var(--color-ink-soft)]">
          {chapter.summaryPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      ) : null}
      <EntryAudio src={chapter.audio} title={chapter.title} />
      {chapter.html ? <SafeHtml className="prose-atlas mt-5" html={chapter.html} /> : null}
    </section>
  );
}

/** "Learn more" panel: the tile's own text (notes) and its resources as cards. */
function TilePanel({ tile }: { tile: LearnMoreTile }) {
  const resources = tile.resources.flatMap((item) => {
    const url = safeUrl(item.url);
    return url ? [{ ...item, url }] : [];
  });
  const titleId = `${tileId(tile)}-title`;
  return (
    <section aria-labelledby={titleId} className="mt-8 border-t border-[var(--color-line)] pt-7">
      <h2
        id={titleId}
        className="font-display text-[22px] leading-snug font-bold text-[var(--color-ink)]"
      >
        {tile.label}
      </h2>
      {tile.description ? (
        <p className="mt-1 text-[13.5px] text-[var(--color-ink-soft)]">{tile.description}</p>
      ) : null}
      {tile.notesHtml ? <SafeHtml className="prose-atlas mt-4" html={tile.notesHtml} /> : null}
      {resources.length ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {resources.map((resource) => {
            const image = cssBackgroundImage(resource.image);
            return (
              <li key={resource.url}>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-full gap-3 rounded-xl border border-[var(--color-line)] p-3 transition hover:border-[var(--color-accent)]"
                >
                  {image ? (
                    <span
                      aria-hidden
                      className="size-16 shrink-0 rounded-lg bg-cover bg-center"
                      style={{ backgroundImage: image }}
                    />
                  ) : null}
                  <span className="min-w-0">
                    <span className="font-display block text-[13.5px] leading-snug font-bold text-[var(--color-ink)]">
                      {resource.title}
                    </span>
                    {resource.source ? (
                      <span className="mt-1 block text-[11.5px] text-[var(--color-ink-muted)]">
                        {resource.source}
                      </span>
                    ) : null}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

/** Author bio with positionality statement (collapsible, target of the header link). */
function AuthorBio({ author }: { author: EntryAuthor }) {
  const t = getT().article;
  const photo = cssBackgroundImage(author.photo);
  return (
    <details
      id={AUTHOR_ID}
      data-hash
      className="group mt-10 scroll-mt-4 border-t border-[var(--color-line)] pt-5"
    >
      <summary className={SUMMARY}>
        {format(t.aboutAuthor, { name: author.name })}
        <ChevronDown aria-hidden className={CHEVRON} />
      </summary>
      <div className="mt-3 flex gap-4">
        {photo ? (
          <span
            role="img"
            aria-label={format(t.photoOf, { name: author.name })}
            className="size-20 shrink-0 rounded-full bg-cover bg-center"
            style={{ backgroundImage: photo }}
          />
        ) : null}
        <p className="text-[13.5px] leading-relaxed whitespace-pre-line text-[var(--color-ink-soft)]">
          {author.bio}
        </p>
      </div>
      {author.positionality ? (
        <>
          <h3 className={`mt-5 ${LABEL}`}>{t.positionality}</h3>
          <p className="mt-2 text-[13.5px] leading-relaxed whitespace-pre-line text-[var(--color-ink-soft)]">
            {author.positionality}
          </p>
        </>
      ) : null}
    </details>
  );
}
