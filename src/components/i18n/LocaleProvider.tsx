"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import {
  applyOverrides,
  getMessages,
  type MessageOverrides,
  type Messages,
} from "@/lib/i18n/messages";

const LocaleContext = createContext<{ locale: Locale; messages: Messages }>({
  locale: DEFAULT_LOCALE,
  // Outside the provider (the admin, the root 404): the built-in texts.
  messages: getMessages(DEFAULT_LOCALE),
});

/**
 * Page language and UI texts for client components (set by the `[locale]`
 * layout). The layout passes only the team's changed texts (Admin → UI
 * texts) — en.json is in the bundle already — and they are merged here once.
 */
export function LocaleProvider({
  locale,
  overrides,
  children,
}: {
  locale: Locale;
  overrides: MessageOverrides;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ locale, messages: applyOverrides(getMessages(locale), overrides) }),
    [locale, overrides],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = (): Locale => useContext(LocaleContext).locale;

/** UI texts in the page language, with the team's changes. */
export const useMessages = (): Messages => useContext(LocaleContext).messages;
