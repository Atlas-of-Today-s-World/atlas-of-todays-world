import { ChevronDown, LayoutGrid } from "lucide-react";
import Link from "@/components/i18n/Link";
import { kickerVariants } from "@/components/atlas/kicker";
import { SafeHtml } from "@/components/atlas/SafeHtml";
import { TilePhoto } from "@/components/atlas/PhotoTile";
import { ShareButton } from "@/components/atlas/ShareButton";
import {
  ARTICLE_BODY,
  ArticleEnd,
  ArticleHero,
  PANEL_SECTION_BLEED,
} from "@/components/atlas/ArticleHero";
import RegionFocus from "@/components/map/RegionFocus";
import { FaqList } from "@/components/portrait/sections";
import { Timeline } from "@/components/portrait/Timeline";
import { VisualsCarousel } from "@/components/visuals/VisualsCarousel";
import type { Atlas } from "@/features/geography/types";
import { format } from "@/lib/i18n/messages";
import { getRequestLocale, getT } from "@/lib/i18n/request";
import { formatLongDate } from "@/lib/format";
import { cssBackgroundImage, safeUrl } from "@/lib/security/urls";
import { PHOTO_WIDTH } from "@/lib/images";
import type {
  Encyclopedia,
  EntryAuthor,
  EntryChapter as Chapter,
  LearnMoreTile,
} from "@/features/entries/types";
import { PlaceLinks } from "./ArticleFrame";
import { DossierExplorer } from "./DossierExplorer";
import { FullReading } from "./FullReading";
import { OpenOnHash } from "./OpenOnHash";
import { ReadingProgress } from "./ReadingProgress";
import { categoryLabel } from "@/lib/content-types";
import { routes } from "@/config/routes";

const AUTHOR_ID = "about-the-author";
/** Panel ids double as URL hashes: `#topic-2`, `#learn-videos`. */
const topicId = (index: number) => `topic-${index + 1}`;
const tileId = (tile: LearnMoreTile) => `learn-${tile.slug}`;

/** Collapsible `<summary>` bar (44 px target); the arrow rotates with the state. */
const SUMMARY =
  "flex min-h-(--touch-min) cursor-pointer list-none items-center gap-2 text-[13px] font-medium text-[var(--color-link)] [&::-webkit-details-marker]:hidden";
const CHEVRON = "size-4 transition-transform group-open:rotate-180";

/**
 * Encyclopedia entry presented as a dossier on a full-width page (FullPage),
 * also for the preview: a photo header with the title, author, dates and key points,
 * the row of chapter cards with the open chapter below, "Learn more" tiles,
 * FAQ and the author's bio. The globe window bottom left turns to the region.
 */
export async function EncyclopediaArticle({
  item,
  atlas,
  banner,
  share = false,
}: {
  item: Encyclopedia;
  atlas: Atlas;
  /** Bar above the article (preview: status and link validity). */
  banner?: React.ReactNode;
  /** The Share button — on the public page only, never on a secret preview link. */
  share?: boolean;
}) {
  const messages = await getT();
  const region = item.region ? atlas.regionBySlug.get(item.region) : undefined;
  return (
    <>
      {/* The corner window shows the whole globe turned to the region: no zoom. */}
      <RegionFocus region={region} zoom={null} activeIso3={item.countries[0] ?? null} />
      {/* A direct child of the FullPage frame, so it stays under the header all the way down. */}
      <ReadingProgress />
      {banner}

      <article lang={item.locale}>
        <ArticleHero
          image={item.hero}
          alt={item.title}
          background={item.heroBackground}
          credit={item.heroCredit}
          crumbLabel={messages.article.breadcrumb}
          // The way back: Atlas › Topics › the topic's category (the title follows).
          crumbs={[
            { label: messages.article.breadcrumbAtlas, href: "/" },
            {
              label: messages.topics.title,
              href: routes.entries,
              pill: true,
              icon: <LayoutGrid aria-hidden className="size-3.5" />,
            },
            { label: categoryLabel(item.category, messages) },
          ]}
          share={share ? item.title : undefined}
          title={item.title}
        >
          <EntryHeader item={item} atlas={atlas} />
        </ArticleHero>

        <div className={ARTICLE_BODY}>
          {/* Text runs the full width of the content, like the tile rows below. */}
          <InShort item={item} />
          {item.html ? <SafeHtml className="prose-atlas mt-7" html={item.html} /> : null}
          {/* The topic's history right after its intro; without events nothing is shown. */}
          {item.timeline ? (
            <div className={`${PANEL_SECTION_BLEED} mt-10`}>
              <Timeline
                items={item.timeline.items}
                title={item.timeline.title}
                subtitle={item.timeline.subtitle}
              />
            </div>
          ) : null}
          {/* Its maps & charts next, still before the subtopics. */}
          {item.visuals.length ? (
            <VisualsCarousel
              items={item.visuals}
              lead={messages.portrait.mapsTopicLead}
              className={item.timeline ? PANEL_SECTION_BLEED : `${PANEL_SECTION_BLEED} mt-10`}
            />
          ) : null}

          <DossierExplorer
            topics={item.chapters.map((chapter, index) => ({
              id: topicId(index),
              title: chapter.title,
              image: chapter.illustration,
              background: chapter.tileBackground,
            }))}
            labels={item.labels}
            tiles={item.tiles.map((tile) => ({
              id: tileId(tile),
              label: tile.label,
              description: tile.description,
              icon: tile.icon,
              image: tile.image,
              background: tile.background,
              count: tile.resources.length,
              empty: !tile.resources.length && !tile.notesHtml,
            }))}
            topicPanels={Object.fromEntries(
              item.chapters.map((chapter, index) => [
                topicId(index),
                <TopicPanel key={topicId(index)} chapter={chapter} index={index} />,
              ]),
            )}
            tilePanels={Object.fromEntries(
              item.tiles
                .filter((tile) => tile.resources.length || tile.notesHtml)
                .map((tile) => [tileId(tile), <TilePanel key={tile.id} tile={tile} />]),
            )}
          />

          {item.faq.length ? (
            <div className={`${PANEL_SECTION_BLEED} mt-14`}>
              <FaqList items={item.faq} />
            </div>
          ) : null}
          {item.authorProfile ? <AuthorBio author={item.authorProfile} /> : null}

          <ArticleEnd href={routes.entries} label={messages.article.allTopics} share={item.title} />
        </div>
      </article>
      <OpenOnHash />
    </>
  );
}

/**
 * On the photo, under the title: places and reading time, the key points at
 * the left, the author (click scrolls to the bio) and dates at the right.
 */
async function EntryHeader({ item, atlas }: { item: Encyclopedia; atlas: Atlas }) {
  const t = (await getT()).article;
  const locale = getRequestLocale();
  const author = item.authorProfile;
  const photo = cssBackgroundImage(author?.photo, PHOTO_WIDTH.avatar);
  return (
    <>
      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/75">
        <PlaceLinks item={item} atlas={atlas} tone="dark" />
        {item.readingMinutes ? (
          <span>{format(t.minRead, { minutes: String(item.readingMinutes) })}</span>
        ) : null}
      </p>

      <div className="mt-5 grid gap-x-10 gap-y-5 md:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]">
        {item.summaryPoints.length ? (
          <section id="key-points" aria-label={t.summary}>
            <ul className="list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-white/90 marker:text-white/60 sm:text-[15px]">
              {item.summaryPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="flex flex-col items-start gap-2 md:col-start-2">
          {author ? (
            <a
              href={`#${AUTHOR_ID}`}
              className="-ml-1 flex min-h-(--touch-min) items-center gap-3 rounded-full pr-3 pl-1 transition hover:bg-white/10"
            >
              {photo ? (
                <span
                  role="img"
                  aria-label={format(t.photoOf, { name: author.name })}
                  className="size-10 shrink-0 rounded-full bg-cover bg-center"
                  style={{ backgroundImage: photo }}
                />
              ) : null}
              <span className="text-[13px] font-medium text-white">
                {format(t.by, { author: author.name })}
              </span>
            </a>
          ) : item.author ? (
            <span className="text-[13px] font-medium text-white">
              {format(t.by, { author: item.author })}
            </span>
          ) : null}
          <dl className="grid grid-cols-[auto_auto] gap-x-2 text-[11.5px] text-white/70">
            {item.published ? (
              <>
                <dt>{t.published}</dt>
                <dd className="text-white/90">
                  <time dateTime={item.published}>{formatLongDate(item.published, locale)}</time>
                </dd>
              </>
            ) : null}
            {item.updated && item.updated !== item.published ? (
              <>
                <dt>{t.updated}</dt>
                <dd className="text-white/90">
                  <time dateTime={item.updated}>{formatLongDate(item.updated, locale)}</time>
                </dd>
              </>
            ) : null}
          </dl>
        </div>
      </div>
    </>
  );
}

/** The answer-first summary (GEO), at the top of the text. */
async function InShort({ item }: { item: Encyclopedia }) {
  if (!item.seo.geoSummary) return null;
  const t = (await getT()).article;
  return (
    <section id="in-short" aria-label={t.inShort}>
      <p className={kickerVariants()}>{t.inShort}</p>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-[var(--color-ink)]">
        {item.seo.geoSummary}
      </p>
    </section>
  );
}

/**
 * Chapter audio version, only when the track exists. It doesn't autoplay (preload none)
 * and the text alternative is the chapter's full text below the player.
 */
async function EntryAudio({ src, title }: { src?: string; title: string }) {
  const t = (await getT()).article;
  const url = safeUrl(src);
  if (!url) return null;
  return (
    <figure className="mt-4">
      <figcaption className={kickerVariants()}>{t.listen}</figcaption>
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

/**
 * Open chapter below the cards: number badge, title, summary, audio and the
 * full text (the card above already shows the photo).
 */
async function TopicPanel({ chapter, index }: { chapter: Chapter; index: number }) {
  const t = (await getT()).article;
  const id = topicId(index);
  return (
    <section aria-labelledby={`${id}-title`} className="mt-12">
      <p className="inline-flex rounded-full bg-[var(--color-ink)] px-2.5 py-0.5 text-[12px] font-semibold text-white">
        {format(t.topic, { number: String(index + 1) })}
      </p>
      {/* Focusable from script: leaving another panel from inside it (Previous / Next) lands here. */}
      <h2
        id={`${id}-title`}
        tabIndex={-1}
        className="font-display mt-3 text-[26px] leading-snug font-bold text-[var(--color-ink)] focus:outline-none sm:text-[30px]"
      >
        {chapter.title}
      </h2>
      {chapter.illustrationCredit || chapter.updated ? (
        <p className="mt-1 text-[10.5px] text-[var(--color-ink-muted)]">
          {chapter.updated
            ? format(t.subtopicUpdated, {
                date: formatLongDate(chapter.updated, getRequestLocale()),
              })
            : null}
          {chapter.updated && chapter.illustrationCredit ? " · " : null}
          {chapter.illustrationCredit}
        </p>
      ) : null}
      <ShareButton title={chapter.title} hash={id} className="mt-3" />
      {chapter.overview || chapter.summaryPoints.length ? (
        // The Overview box first; the whole text only on "Full Reading".
        <FullReading
          label={t.fullReading}
          overview={
            <>
              <p className="inline-flex rounded-full bg-[var(--color-ink-muted)] px-2.5 py-0.5 text-[12px] font-semibold text-white">
                {t.overview}
              </p>
              <Overview text={chapter.overview} points={chapter.summaryPoints} />
              <EntryAudio src={chapter.audio} title={chapter.title} />
            </>
          }
        >
          <ChapterText chapter={chapter} id={id} />
        </FullReading>
      ) : (
        <>
          <EntryAudio src={chapter.audio} title={chapter.title} />
          <ChapterText chapter={chapter} id={id} />
        </>
      )}
    </section>
  );
}

/**
 * A subtopic's overview: its paragraphs (a blank line between them in the
 * admin), then the key points. A lone key point reads as a paragraph.
 */
function Overview({ text, points }: { text: string; points: string[] }) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const type = "text-[15px] leading-relaxed text-[var(--color-ink)]";
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className={`mt-3 ${type}`}>
          {paragraph}
        </p>
      ))}
      {points.length === 1 ? <p className={`mt-3 ${type}`}>{points[0]}</p> : null}
      {points.length > 1 ? (
        <ul className={`mt-3 list-disc space-y-1.5 pl-5 ${type}`}>
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/** A subtopic's whole text and its maps & charts. */
function ChapterText({ chapter, id }: { chapter: Chapter; id: string }) {
  return (
    <>
      {chapter.html ? <SafeHtml className="prose-atlas mt-6" html={chapter.html} /> : null}
      {chapter.visuals.length ? (
        <VisualsCarousel items={chapter.visuals} variant="inline" id={`${id}-maps`} />
      ) : null}
    </>
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
    <section aria-labelledby={titleId} className="mt-12">
      {/* Focusable from script, like a subtopic's heading. */}
      <h2
        id={titleId}
        tabIndex={-1}
        className="font-display text-[22px] leading-snug font-bold text-[var(--color-ink)] focus:outline-none"
      >
        {tile.label}
      </h2>
      {tile.description ? (
        <p className="mt-1 text-[13.5px] text-[var(--color-ink-soft)]">{tile.description}</p>
      ) : null}
      {tile.notesHtml ? <SafeHtml className="prose-atlas mt-4" html={tile.notesHtml} /> : null}
      {resources.length ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {resources.map((resource, index) => {
            const image = safeUrl(resource.image);
            return (
              // The same link may sit in a tile twice (under two sub-headings).
              <li key={`${index}-${resource.url}`}>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-full gap-3 rounded-xl border border-[var(--color-line)] p-3 transition hover:border-[var(--color-accent)]"
                >
                  {/* The source's own preview (og:image or a video thumbnail), loaded straight from it. */}
                  {image ? (
                    <span
                      aria-hidden
                      className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-[var(--color-line)]"
                    >
                      <TilePhoto image={image} width={PHOTO_WIDTH.thumb} />
                    </span>
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
async function AuthorBio({ author }: { author: EntryAuthor }) {
  const messages = await getT();
  const t = messages.article;
  const photo = cssBackgroundImage(author.photo, PHOTO_WIDTH.avatar);
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
          <h3 className={`mt-5 ${kickerVariants()}`}>{t.positionality}</h3>
          <p className="mt-2 text-[13.5px] leading-relaxed whitespace-pre-line text-[var(--color-ink-soft)]">
            {author.positionality}
          </p>
        </>
      ) : null}
      {author.slug ? (
        <Link
          href={routes.author(author.slug)}
          rel="author"
          className="mt-4 flex min-h-(--touch-min) items-center text-[13px] font-medium text-[var(--color-link)] hover:underline"
        >
          {format(messages.authorPage.articles, { name: author.name })}
        </Link>
      ) : null}
    </details>
  );
}
