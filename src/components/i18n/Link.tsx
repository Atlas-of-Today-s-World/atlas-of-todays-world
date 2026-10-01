"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { localePath } from "@/features/i18n/config";
import { useLocale } from "./LocaleProvider";

/** Cesty mimo jazykové verze (administrace, API, přihlašovací callbacky). */
const UNLOCALIZED = /^\/(admin|api|auth)(\/|$)/;

/**
 * `next/link` pro veřejný web: interní cesta dostane jazykovou předponu
 * stránky (`/country/x` → `/cs/country/x`), takže komponenty píšou odkazy
 * jen jednou, bez ohledu na jazyk.
 */
export default function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const locale = useLocale();
  const localized =
    typeof href === "string" && href.startsWith("/") && !UNLOCALIZED.test(href)
      ? localePath(locale, href)
      : href;
  return <NextLink href={localized} {...props} />;
}
