"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { localePath } from "@/features/i18n/config";
import { useLocale } from "./LocaleProvider";

/** Paths outside the language versions (admin, API, auth callbacks). */
const UNLOCALIZED = /^\/(admin|api|auth)(\/|$)/;

/**
 * `next/link` for the public site: an internal path gets the page's language
 * prefix (`/country/x` → `/cs/country/x`), so components write links
 * just once, regardless of language.
 */
export default function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const locale = useLocale();
  const localized =
    typeof href === "string" && href.startsWith("/") && !UNLOCALIZED.test(href)
      ? localePath(locale, href)
      : href;
  return <NextLink href={localized} {...props} />;
}
