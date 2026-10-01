"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/features/i18n/config";
import { getMessages, type Messages } from "@/features/i18n/messages";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Page language for client components (set by the `[locale]` layout). */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export const useLocale = (): Locale => useContext(LocaleContext);

/** UI texts in the page language. */
export const useMessages = (): Messages => getMessages(useLocale());
