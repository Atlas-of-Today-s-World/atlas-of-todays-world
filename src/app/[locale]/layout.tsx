import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { isLocale, LOCALES } from "@/features/i18n/config";

/**
 * Jazyková verze veřejného webu (G5). Angličtina je na adresách bez předpony
 * (proxy je přepíše na /en/…), ostatní jazyky pod /cs/… a podobně.
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
      {/* <html lang> je společný kořen; jazyk obsahu nese tenhle obal (WCAG 3.1.2). */}
      <div lang={locale} className="contents">
        {children}
      </div>
    </LocaleProvider>
  );
}
