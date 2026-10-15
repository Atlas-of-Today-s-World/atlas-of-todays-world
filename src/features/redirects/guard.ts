import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n/config";
import { localeFrom } from "@/lib/i18n/request";
import { redirectOrNotFound } from "./queries";

/**
 * Layout of a dynamic public route (`/country/[slug]`, `/view/[indicator]`…):
 * an unknown URL → redirect (managed in the admin), otherwise a real 404,
 * both before streaming starts. The pages have loading.tsx, so notFound()
 * inside them would be sent with status 200.
 *
 * `exists` says whether the segment value names a real page; `path` builds its
 * public URL (from `routes`) to look up a redirect for.
 */
export function guardedLayout<Key extends string = "slug">(
  exists: (value: string, locale: Locale) => Promise<boolean>,
  path: (value: string) => string,
  param: Key = "slug" as Key,
) {
  return async function GuardedLayout({
    children,
    params,
  }: {
    children: ReactNode;
    params: Promise<{ locale: string } & Record<Key, string>>;
  }) {
    const value = (await params)[param];
    const locale = await localeFrom(params);
    if (!(await exists(value, locale))) return redirectOrNotFound(path(value), locale);
    return children;
  };
}
