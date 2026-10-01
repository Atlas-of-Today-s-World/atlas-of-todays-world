"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { LOCALE_NAMES, LOCALES, localePath, splitLocale } from "@/features/i18n/config";
import { format } from "@/features/i18n/messages";
import { cn } from "@/lib/cn";
import { useLocale, useMessages } from "./LocaleProvider";

/**
 * Language switcher: the same page in another language (untranslated texts stay
 * in English). Links are plain <a>, so they work without JavaScript too.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useMessages();
  const { path } = splitLocale(usePathname());

  return (
    <span role="group" aria-label={t.header.language} className={cn("flex gap-1", className)}>
      {LOCALES.map((item) =>
        item === locale ? (
          <span
            key={item}
            aria-current="true"
            className="grid min-h-11 min-w-11 place-items-center font-semibold text-white uppercase"
          >
            {item}
          </span>
        ) : (
          <NextLink
            key={item}
            href={localePath(item, path)}
            hrefLang={item}
            lang={item}
            aria-label={format(t.header.switchTo, { language: LOCALE_NAMES[item] })}
            className="grid min-h-11 min-w-11 place-items-center text-white/60 uppercase transition hover:text-white"
          >
            {item}
          </NextLink>
        ),
      )}
    </span>
  );
}
