import { ChevronDown } from "lucide-react";
import { SafeHtml } from "@/components/atlas/SafeHtml";
import { ResourceLibrary } from "@/components/portrait/sections";
import type { Atlas } from "@/features/geography/types";
import { formatLongDate } from "@/lib/format";
import { cssBackgroundImage, safeUrl } from "@/lib/security/urls";
import type { Encyclopedia, EntryAuthor, EntryChapter as Chapter } from "../queries";
import { ArticleFrame, META_LINE, PlaceLinks } from "./ArticleFrame";
import { OpenOnHash } from "./OpenOnHash";

const AUTHOR_ID = "about-the-author";
const chapterId = (index: number) => `chapter-${index + 1}`;

/** Rozbalovací pruh `<summary>` (cíl 44 px); šipka se otočí podle stavu. */
const SUMMARY =
  "flex min-h-11 cursor-pointer list-none items-center gap-2 text-[13px] font-medium text-[var(--color-link)] [&::-webkit-details-marker]:hidden";
const CHEVRON = "size-4 transition-transform group-open:rotate-180";
const LABEL = "text-[11px] font-medium tracking-[0.1em] text-[var(--color-ink-muted)] uppercase";

/**
 * Encyklopedické heslo (P9) pro veřejnou stránku i náhled: hlavička s autorem
 * a shrnutím, zvuková verze, kapitoly otevřené shrnutím a rozbalitelné do
 * plného textu, zdroje a životopis autora.
 */
export function EncyclopediaArticle({
  item,
  atlas,
  banner,
}: {
  item: Encyclopedia;
  atlas: Atlas;
  /** Pruh nad článkem (náhled: stav a platnost odkazu). */
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

      {item.chapters.length > 1 ? (
        <nav
          aria-label="Chapters"
          className="mt-7 rounded-xl border border-[var(--color-line)] p-4"
        >
          <p className={LABEL}>In this entry</p>
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

/** Autor s fotkou (klik sroluje na životopis), data a odrážky shrnutí. */
function EntryHeader({ item, atlas }: { item: Encyclopedia; atlas: Atlas }) {
  const author = item.authorProfile;
  const photo = cssBackgroundImage(author?.photo);
  return (
    <>
      <p className={META_LINE}>
        <PlaceLinks item={item} atlas={atlas} />
        {item.readingMinutes ? <span>{item.readingMinutes} min read</span> : null}
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
                aria-label={`Photo of ${author.name}`}
                className="size-11 shrink-0 rounded-full bg-cover bg-center"
                style={{ backgroundImage: photo }}
              />
            ) : null}
            <span className="text-[13px] font-medium text-[var(--color-ink)]">
              By {author.name}
            </span>
          </a>
        ) : item.author ? (
          <span className="text-[13px] font-medium text-[var(--color-ink)]">By {item.author}</span>
        ) : null}
        <dl className="ml-auto grid grid-cols-[auto_auto] gap-x-2 text-[11.5px] text-[var(--color-ink-muted)]">
          {item.published ? (
            <>
              <dt>Published</dt>
              <dd>
                <time dateTime={item.published}>{formatLongDate(item.published)}</time>
              </dd>
            </>
          ) : null}
          {item.updated && item.updated !== item.published ? (
            <>
              <dt>Last updated</dt>
              <dd>
                <time dateTime={item.updated}>{formatLongDate(item.updated)}</time>
              </dd>
            </>
          ) : null}
        </dl>
      </div>

      {item.summaryPoints.length ? (
        <section aria-label="Summary" className="mt-6 rounded-xl bg-[var(--color-line)]/25 p-4">
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
 * Zvuková verze kapitoly, jen když stopa existuje. Nehraje sama (preload none)
 * a textovou alternativou je plný text kapitoly pod přehrávačem.
 */
function EntryAudio({ src, title }: { src?: string; title: string }) {
  const url = safeUrl(src);
  if (!url) return null;
  return (
    <figure className="mt-4">
      <figcaption className={LABEL}>Listen to this chapter</figcaption>
      <audio
        controls
        preload="none"
        src={url}
        aria-label={`Audio version: ${title}`}
        className="mt-2 w-full"
      >
        <a href={url}>Download the audio version</a>
      </audio>
      <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
        The transcript is the full chapter text below.
      </p>
    </figure>
  );
}

/** Kapitola: ilustrace, titulek a shrnutí vždy; plný text po rozbalení. */
function EntryChapter({ chapter, index }: { chapter: Chapter; index: number }) {
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
      <p className={`mt-5 ${LABEL}`}>Chapter {index + 1}</p>
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
            <span className="group-open:hidden">Read the full chapter</span>
            <span className="hidden group-open:inline">Close the chapter</span>
            <ChevronDown aria-hidden className={CHEVRON} />
          </summary>
          <SafeHtml className="prose-atlas mt-3" html={chapter.html} />
        </details>
      ) : null}
    </section>
  );
}

/** Životopis autora s positionality statement (rozbalovací, cíl odkazu z hlavičky). */
function AuthorBio({ author }: { author: EntryAuthor }) {
  const photo = cssBackgroundImage(author.photo);
  return (
    <details
      id={AUTHOR_ID}
      data-hash
      className="group mt-10 scroll-mt-4 border-t border-[var(--color-line)] pt-5"
    >
      <summary className={SUMMARY}>
        About the author: {author.name}
        <ChevronDown aria-hidden className={CHEVRON} />
      </summary>
      <div className="mt-3 flex gap-4">
        {photo ? (
          <span
            role="img"
            aria-label={`Photo of ${author.name}`}
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
          <h3 className={`mt-5 ${LABEL}`}>Positionality statement</h3>
          <p className="mt-2 text-[13.5px] leading-relaxed whitespace-pre-line text-[var(--color-ink-soft)]">
            {author.positionality}
          </p>
        </>
      ) : null}
    </details>
  );
}
