import { notFound } from "next/navigation";
import { CookieNotice } from "@/components/CookieNotice";
import { TabReminder } from "@/components/TabReminder";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { JsonLd } from "@/components/JsonLd";
import { isLocale, LOCALES, localePath } from "@/lib/i18n/config";
import { getMessagesFor, getOverridesFor } from "@/lib/i18n/request";
import { absoluteUrl } from "@/lib/seo";
import { graph, organizationNode, websiteNode, builderNode } from "@/features/seo/jsonld";
import { getSiteSettings, getSocialLinks } from "@/features/site/queries";

/**
 * Language version of the public site (G5). English lives at URLs without a prefix
 * (the proxy rewrites them to /en/…); another language would get its own /<code>/… prefix.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [messages, overrides, site, socials] = await Promise.all([
    getMessagesFor(locale),
    getOverridesFor(locale),
    getSiteSettings(),
    getSocialLinks(),
  ]);
  const t = messages.seo;
  return (
    <LocaleProvider locale={locale} overrides={overrides}>
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
      <JsonLd
        data={graph(organizationNode(site, socials), websiteNode(locale, site), builderNode())}
      />
      {/* <html lang> is the shared root; this wrapper carries the content language (WCAG 3.1.2). */}
      <div lang={locale} className="contents">
        {children}
        <CookieNotice />
        <TabReminder />
      </div>
    </LocaleProvider>
  );
}
