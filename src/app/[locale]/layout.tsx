import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { isLocale, LOCALES } from "@/features/i18n/config";

/**
 * Language version of the public site (G5). English lives at URLs without a prefix
 * (the proxy rewrites them to /en/…), other languages under /cs/… and so on.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <LocaleProvider locale={locale}>
      {/* <html lang> is the shared root; this wrapper carries the content language (WCAG 3.1.2). */}
      <div lang={locale} className="contents">
        {children}
      </div>
    </LocaleProvider>
  );
}
