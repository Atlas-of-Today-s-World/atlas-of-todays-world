import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { CookieNotice } from "@/components/CookieNotice";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { JsonLd } from "@/components/JsonLd";
import { isLocale, LOCALES, localePath } from "@/features/i18n/config";
import { getMessages } from "@/features/i18n/messages";
import { absoluteUrl } from "@/lib/seo";
import { graph, organizationNode, websiteNode } from "@/lib/seo/jsonld";

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
  const t = getMessages(locale).seo;
  return (
    <LocaleProvider locale={locale}>
      {/* Discovery links on every page (React puts <link> into <head>): feeds and llms.txt (ADR-021). */}
      <link
        rel="alternate"
        type="application/rss+xml"
        title={t.feedTitle}
        href={absoluteUrl(localePath(locale, "/feed.xml"))}
      />
      <link
        rel="alternate"
        type="application/atom+xml"
        title={t.feedTitle}
        href={absoluteUrl(localePath(locale, "/atom.xml"))}
      />
      <link
        rel="describedby"
        type="text/plain"
        href={absoluteUrl(localePath(locale, "/llms.txt"))}
      />
      {/* The publisher and the website, referenced by @id from every page's own graph. */}
      <JsonLd data={graph(organizationNode(), websiteNode(locale))} />
      {/* <html lang> is the shared root; this wrapper carries the content language (WCAG 3.1.2). */}
      <div lang={locale} className="contents">
        {children}
        <CookieNotice />
      </div>
    </LocaleProvider>
  );
}
