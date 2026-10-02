import "server-only";
import { isLocale, localePath, LOCALES } from "@/features/i18n/config";
import { getMessages } from "@/features/i18n/messages";
import { ORGANIZATION } from "@/config/organization";
import { absoluteUrl } from "@/lib/seo";
import { machineResponse } from "@/lib/seo/response";
import { atomXml, rssXml, type FeedMeta } from "@/lib/seo/xml";
import { getFeedItems, getLlmsFullTxt, getLlmsTxt } from "./queries";

/**
 * Route handlers of the per-language machine files (`/feed.xml`, `/cs/feed.xml`,
 * `/atom.xml`, `/llms.txt`, `/llms-full.txt`). The proxy maps the unprefixed
 * English URL to `[locale]=en`, like pages.
 */
type Params = { params: Promise<{ locale: string }> };

export const localeParams = () => LOCALES.map((locale) => ({ locale }));

const notFound = () => new Response("Not found", { status: 404 });

function feedMeta(locale: (typeof LOCALES)[number], file: string): FeedMeta {
  const t = getMessages(locale).seo;
  return {
    title: t.feedTitle,
    description: t.feedDescription,
    home: absoluteUrl(localePath(locale, "/")),
    self: absoluteUrl(localePath(locale, file)),
    language: locale,
    logo: absoluteUrl(ORGANIZATION.logoPath),
    email: ORGANIZATION.email,
    publisher: ORGANIZATION.name,
  };
}

export function feedRoute(format: "rss" | "atom") {
  return async (_request: Request, { params }: Params) => {
    const { locale } = await params;
    if (!isLocale(locale)) return notFound();
    const items = await getFeedItems(locale);
    return format === "rss"
      ? machineResponse(rssXml(feedMeta(locale, "/feed.xml"), items), "rss")
      : machineResponse(atomXml(feedMeta(locale, "/atom.xml"), items), "atom");
  };
}

export function llmsRoute(full: boolean) {
  return async (_request: Request, { params }: Params) => {
    const { locale } = await params;
    if (!isLocale(locale)) return notFound();
    const body = full ? await getLlmsFullTxt(locale) : await getLlmsTxt(locale);
    // Plain text, so every browser shows it instead of downloading a .md file.
    return machineResponse(body, "text");
  };
}
