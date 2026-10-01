import { ChevronDown } from "lucide-react";
import { SafeHtml } from "@/components/atlas/SafeHtml";
import { ResourceLibrary } from "@/components/portrait/sections";
import type { Atlas } from "@/features/geography/types";
import { format } from "@/features/i18n/messages";
import { getRequestLocale, getT } from "@/features/i18n/request";
import { formatLongDate } from "@/lib/format";
import { cssBackgroundImage, safeUrl } from "@/lib/security/urls";
import type { Encyclopedia, EntryAuthor, EntryChapter as Chapter } from "../queries";
import { ArticleFrame, META_LINE, PlaceLinks } from "./ArticleFrame";
import { OpenOnHash } from "./OpenOnHash";

const AUTHOR_ID = "about-the-author";
const chapterId = (index: number) => `chapter-${index + 1}`;

/** Collapsible `<summary>` bar (44 px target); the arrow rotates with the state. */
const SUMMARY =
  "flex min-h-11 cursor-pointer list-none items-center gap-2 text-[13px] font-medium text-[var(--color-link)] [&::-webkit-details-marker]:hidden";
const CHEVRON = "size-4 transition-transform group-open:rotate-180";
const LABEL = "text-[11px] font-medium tracking-[0.1em] text-[var(--color-ink-muted)] uppercase";

/**
 * Encyclopedia entry (P9) for the public page and preview: header with author
 * and summary, audio version, chapters opened with their summary and expandable
 * to full text, sources and the author's bio.
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
  const t = getT().article;
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

      {item.chapters.length > 1 ? (
        <nav
          aria-label={t.chapters}
          className="mt-7 rounded-xl border border-[var(--color-line)] p-4"
        >
          <p className={LABEL}>{t.inThisEntry}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px]">
            {item.chapters.map((chapter, index) => (
              <li key={chapterId(index)}>
                <a
                  href={`#${chapterId(index)}`}
                  className="inline-flex min-h-8 items-center text-[var(--color-link)] hover:underline"
                >
                  {chapter.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      {item.chapters.map((chapter, index) => (
        <EntryChapter key={chapterId(index)} chapter={chapter} index={index} />
      ))}

      {item.resources.length ? (
        <div className="-mx-6 mt-10 sm:-mx-10">
          <ResourceLibrary resources={item.resources} />
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

/** Chapter: illustration, title and summary always; full text when expanded. */
function EntryChapter({ chapter, index }: { chapter: Chapter; index: number }) {
  const t = getT().article;
  const id = chapterId(index);
  const illustration = cssBackgroundImage(chapter.illustration);
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="mt-10 border-t border-[var(--color-line)] pt-7"
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
      <p className={`mt-5 ${LABEL}`}>{format(t.chapter, { number: String(index + 1) })}</p>
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
      {chapter.html ? (
        <details id={id} data-hash className="group mt-3 scroll-mt-4">
          <summary className={SUMMARY}>
            <span className="group-open:hidden">{t.readChapter}</span>
            <span className="hidden group-open:inline">{t.closeChapter}</span>
            <ChevronDown aria-hidden className={CHEVRON} />
          </summary>
          <SafeHtml className="prose-atlas mt-3" html={chapter.html} />
        </details>
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
