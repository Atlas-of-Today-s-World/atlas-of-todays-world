import type { Locale } from "@/features/i18n/config";
import { getMessages } from "@/features/i18n/messages";

/**
 * Pruh nad článkem, když překlad do jazyka stránky chybí a čtenář vidí
 * originál (G5.3). Jinak nic.
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
