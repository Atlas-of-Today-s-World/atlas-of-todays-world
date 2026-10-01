"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { localePath } from "@/features/i18n/config";
import { useLocale } from "./LocaleProvider";

/** `useRouter` pro veřejný web: push/prefetch s jazykovou předponou stránky. */
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
