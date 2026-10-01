import type { ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/features/i18n/config";
import { getMessages } from "@/features/i18n/messages";

/**
 * Obsah, který zatím existuje jen anglicky (právní texty). V jiném jazyce nad
 * ním stojí poznámka a obsah nese lang="en", aby ho čtečka četla anglicky.
 */
export function EnglishOnly({ locale, children }: { locale: Locale; children: ReactNode }) {
  if (locale === DEFAULT_LOCALE) return <>{children}</>;
  return (
    <>
      <p role="note" className="mb-6 rounded-lg bg-[var(--color-line)]/40 px-4 py-3 text-[13px]">
        {getMessages(locale).legal.englishOnly}
      </p>
      <div lang="en">{children}</div>
    </>
  );
}
