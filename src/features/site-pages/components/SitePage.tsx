import "server-only";
import type { Metadata } from "next";
import { localeFrom } from "@/features/i18n/request";
import { pageMetadata } from "@/lib/seo/metadata";
import { SITE_PAGE_PATH, type SitePageSlug } from "../pages";
import { getSitePage } from "../queries";
import { SitePageView } from "./SitePageView";

type Params = Promise<{ locale: string }>;

/** Metadata of a site page from its row (title, description), or the built-in text. */
export async function sitePageMetadata(slug: SitePageSlug, params: Params): Promise<Metadata> {
  const page = await getSitePage(slug);
  return pageMetadata({
    locale: await localeFrom(params),
    path: SITE_PAGE_PATH[slug],
    title: page.title,
    description: page.description,
  });
}

/** A whole site page without parts in code (Privacy, Terms, Accessibility). */
export async function SitePage({ slug, params }: { slug: SitePageSlug; params: Params }) {
  const locale = await localeFrom(params);
  return <SitePageView page={await getSitePage(slug)} locale={locale} />;
}
