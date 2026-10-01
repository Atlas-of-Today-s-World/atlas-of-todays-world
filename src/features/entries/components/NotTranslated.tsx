import type { Locale } from "@/features/i18n/config";
import { getMessages } from "@/features/i18n/messages";

/**
 * Bar above the article when a translation into the page language is missing
 * and the reader sees the original (G5.3). Otherwise nothing.
 */
export function NotTranslated({ page, text }: { page: Locale; text: Locale }) {
  if (page === text) return null;
  return (
    <p
      role="note"
      className="border-b border-[var(--color-line)] bg-[var(--color-accent-soft)] px-6 py-3 text-[12.5px] text-[var(--color-ink-soft)] sm:px-10"
    >
      {getMessages(page).common.notTranslated}
    </p>
  );
}
