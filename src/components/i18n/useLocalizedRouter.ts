"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { localePath } from "@/features/i18n/config";
import { useLocale } from "./LocaleProvider";

/** `useRouter` for the public site: push/prefetch with the page's language prefix. */
export function useLocalizedRouter() {
  const router = useRouter();
  const locale = useLocale();
  return useMemo(
    () => ({
      push: (href: string) => router.push(localePath(locale, href)),
      prefetch: (href: string) => router.prefetch(localePath(locale, href)),
    }),
    [router, locale],
  );
}
