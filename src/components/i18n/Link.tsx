"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { localePath } from "@/features/i18n/config";
import { useLocale } from "./LocaleProvider";

/** Paths outside the language versions (admin, API, auth callbacks). */
const UNLOCALIZED = /^\/(admin|api|auth)(\/|$)/;

/**
 * `next/link` for the public site: an internal path gets the page's language
 * prefix (`/country/x` → `/cs/country/x`), so components write links
 * just once, regardless of language.
 *
 * `prefetchOnIntent`: no prefetch when the link scrolls into view, only once the
 * visitor points at it (hover, focus, touch). For links on the first screen that
 * lead to heavy routes: the page itself then stays light, the click still fast.
 */
export default function Link({
  href,
  prefetchOnIntent = false,
  ...props
}: ComponentProps<typeof NextLink> & { prefetchOnIntent?: boolean }) {
  const locale = useLocale();
  const router = useRouter();
  const localized =
    typeof href === "string" && href.startsWith("/") && !UNLOCALIZED.test(href)
      ? localePath(locale, href)
      : href;
  if (!prefetchOnIntent || typeof localized !== "string") {
    return <NextLink href={localized} {...props} />;
  }
  const prefetch = () => router.prefetch(localized);
  return (
    <NextLink
      href={localized}
      {...props}
      prefetch={false}
      onMouseEnter={(event) => {
        prefetch();
        props.onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        prefetch();
        props.onFocus?.(event);
      }}
      onTouchStart={(event) => {
        prefetch();
        props.onTouchStart?.(event);
      }}
    />
  );
}
