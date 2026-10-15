import { Rail } from "@/components/atlas/Rail";
import { SafeHtml } from "@/components/atlas/SafeHtml";
import { SourceLink } from "@/components/atlas/ui";
import { kickerVariants } from "@/components/atlas/kicker";
import type { TimelineItem } from "@/lib/content-types";
import { cn } from "@/lib/cn";
import { getT } from "@/lib/i18n/request";
import { htmlToText } from "@/lib/text/html";
import { TimelineText } from "./TimelineText";

/** Roughly how many characters fill a line of the 18 rem card at 13 px. */
const CHARS_PER_LINE = 40;

/** The server's guess whether an event's text and sources run over ten lines (the browser measures). */
function looksLong(item: TimelineItem): boolean {
  const text = item.html ? htmlToText(item.html, { blockEnd: "\n" }) : item.text;
  const paragraphs = text.split("\n").filter((line) => line.trim());
  const lines =
    paragraphs.reduce((sum, line) => sum + Math.ceil(line.length / CHARS_PER_LINE), 0) +
    (item.sources?.length ? 1 + item.sources.length * 2 : 0);
  return lines > 10;
}

/**
 * The timeline as the original site drew it, in the Atlas design: a dark
 * "Timeline" pill, a large centred heading and subheading, then a horizontal
 * row of events (Rail: drag, swipe, arrows, ←/→) — each a title, its date, a
 * blue dot on a thin line running through the row, and the text cut after ten
 * lines with "More" opening the rest and its sources. The same for a region,
 * a global issue, a country and a topic.
 */
export async function Timeline({
  items,
  title,
  subtitle,
  id = "timeline",
  className,
}: {
  items: TimelineItem[];
  /** Editor's heading; empty = the default one. */
  title?: string;
  subtitle?: string;
  /** Anchor of the section; two timelines on one page (a country and its region) need two. */
  id?: string;
  className?: string;
}) {
  const t = await getT();
  const heading = title?.trim() || t.portrait.timeline;
  const headingId = `${id}-title`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("border-t border-[var(--color-line)] px-6 py-10 sm:px-10", className)}
    >
      <div className="text-center">
        <p className={kickerVariants({ tone: "pill" })}>{t.portrait.timelineKicker}</p>
        <h2
          id={headingId}
          className="font-display mx-auto mt-4 max-w-2xl text-[26px] leading-tight font-bold text-balance text-[var(--color-ink)] sm:text-[32px]"
        >
          {heading}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-[13.5px] leading-relaxed text-[var(--color-ink-muted)]">
          {subtitle?.trim() || t.portrait.timelineLead}
        </p>
      </div>

      <Rail label={heading} gap="lg" className="mt-8">
        {items.map((item, index) => (
          <article
            key={`${index}-${item.date}-${item.title}`}
            className="w-72 max-w-[78vw] shrink-0 snap-start"
          >
            {/* Title and date sit on the line, so the dots of a row line up. */}
            <div className="flex min-h-28 flex-col justify-end">
              <h3 className="font-display text-[17px] leading-snug font-bold text-[var(--color-ink)]">
                {item.title}
              </h3>
              <p className="mt-1 text-[12.5px] font-medium text-[var(--color-ink-muted)]">
                {item.date}
              </p>
            </div>
            <div aria-hidden className="my-4 -mr-6 flex items-center">
              <span
                className={cn(
                  "size-3.5 shrink-0 rounded-full bg-[var(--color-accent)]",
                  index === 0 && "ring-4 ring-[var(--color-accent)]/25",
                )}
              />
              <span className="h-px flex-1 bg-[var(--color-line)]" />
            </div>
            {item.html || item.text || item.sources?.length ? (
              <TimelineText
                long={looksLong(item)}
                more={t.portrait.timelineMore}
                less={t.portrait.timelineLess}
              >
                {item.html ? (
                  <SafeHtml className="prose-atlas prose-compact" html={item.html} />
                ) : item.text ? (
                  <p className="leading-relaxed whitespace-pre-line text-[var(--color-ink-soft)]">
                    {item.text}
                  </p>
                ) : null}
                {item.sources?.length ? (
                  <div className="mt-3">
                    <p className={kickerVariants()}>{t.portrait.timelineSources}</p>
                    <ul className="mt-1 space-y-0.5 text-[12px] leading-snug">
                      {item.sources.map((source, at) => (
                        <li key={`${at}-${source.url}`}>
                          <SourceLink href={source.url}>{source.title}</SourceLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </TimelineText>
            ) : null}
          </article>
        ))}
      </Rail>
    </section>
  );
}
