import { SafeHtml } from "@/components/atlas/SafeHtml";
import type { Atlas } from "@/features/geography/types";
import { getRequestLocale, getT } from "@/features/i18n/request";
import { format } from "@/features/i18n/messages";
import { formatLongDate } from "@/lib/format";
import type { Entry } from "../queries";
import { ArticleFrame, META_LINE, PlaceLinks } from "./ArticleFrame";

/**
 * Novinka tak, jak ji vidí čtenář (mapa zaostřená na region + článek).
 * Jediná podoba pro veřejnou stránku i náhled nezveřejněného článku.
 */
export function NewsArticle({
  item,
  atlas,
  banner,
}: {
  item: Entry;
  atlas: Atlas;
  /** Pruh nad článkem (náhled: stav a platnost odkazu). */
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
