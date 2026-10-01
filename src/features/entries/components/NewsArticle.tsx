import { SafeHtml } from "@/components/atlas/SafeHtml";
import type { Atlas } from "@/features/geography/types";
import { getRequestLocale, getT } from "@/features/i18n/request";
import { format } from "@/features/i18n/messages";
import { formatLongDate } from "@/lib/format";
import type { Entry } from "../queries";
import { ArticleFrame, META_LINE, PlaceLinks } from "./ArticleFrame";

/**
 * A news item as the reader sees it (map focused on the region + article).
 * The single rendering for both the public page and the unpublished-article preview.
 */
export function NewsArticle({
  item,
  atlas,
  banner,
}: {
  item: Entry;
  atlas: Atlas;
  /** Bar above the article (preview: status and link validity). */
  banner?: React.ReactNode;
}) {
  const t = getT().article;
  const locale = getRequestLocale();
  return (
    <ArticleFrame item={item} atlas={atlas} banner={banner} lang={item.locale}>
      <p className={META_LINE}>
        <PlaceLinks item={item} atlas={atlas} />
        {item.author ? <span>{format(t.by, { author: item.author })}</span> : null}
        {item.published ? (
          <time dateTime={item.published}>{formatLongDate(item.published, locale)}</time>
        ) : null}
        {item.readingMinutes ? (
          <span>{format(t.minRead, { minutes: String(item.readingMinutes) })}</span>
        ) : null}
      </p>

      <SafeHtml
        className="prose-atlas mt-7 border-t border-[var(--color-line)] pt-6"
        html={item.html}
      />
    </ArticleFrame>
  );
}
