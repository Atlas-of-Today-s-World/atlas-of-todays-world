import type { ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/features/i18n/config";
import { getMessages } from "@/features/i18n/messages";

/**
 * Content that so far exists only in English (legal texts). In other languages a
 * note sits above it and the content carries lang="en" so screen readers read it in English.
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
