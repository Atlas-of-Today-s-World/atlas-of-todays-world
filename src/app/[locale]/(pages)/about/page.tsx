import { getAtlas } from "@/features/geography/queries";
import { format } from "@/lib/i18n/messages";
import { getMessagesFor, localeFrom } from "@/lib/i18n/request";
import { DevelogiCredit } from "@/components/DevelogiCredit";
import { JsonLd } from "@/components/JsonLd";
import { postalAddress } from "@/features/site/model";
import { getSiteSettings } from "@/features/site/queries";
import { sitePageMetadata } from "@/features/site-pages/components/SitePage";
import { SitePageView } from "@/features/site-pages/components/SitePageView";
import { getSitePage } from "@/features/site-pages/queries";
import { breadcrumbNode, graph, ids, pageUrl, webPageNode } from "@/features/seo/jsonld";
import { routes } from "@/config/routes";

export function generateMetadata({ params }: PageProps<"/[locale]/about">) {
  return sitePageMetadata("about", params);
}

/**
 * About the Atlas. The text is edited in the admin (Site pages); the live
 * list of data sources (at the body's {{data-sources}} paragraph) and the
 * publisher line stay in code.
 */
export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const locale = await localeFrom(params);
  const messages = await getMessagesFor(locale);
  const t = messages.about;
  const [page, { indicators }, site] = await Promise.all([
    getSitePage("about"),
    getAtlas(locale),
    getSiteSettings(),
  ]);
  return (
    <SitePageView
      page={page}
      locale={locale}
      dataSources={
        <ul>
          {indicators.map((indicator) => (
            <li key={indicator.id}>
              <strong>{indicator.label}</strong> &mdash; {indicator.source} ({indicator.latestYear})
            </li>
          ))}
        </ul>
      }
    >
      <h2 id="publisher">{t.whoTitle}</h2>
      <p>
        {format(t.whoText, {
          legalName: site.legalName,
          companyId: site.companyId,
          address: postalAddress(site),
          email: site.email,
        })}
      </p>

      <DevelogiCredit
        text={messages.patrons.builtWith}
        label={messages.patrons.builtWithLabel}
        className="mt-12 justify-start border-t border-[var(--color-line)] pt-6"
      />

      <JsonLd
        data={graph(
          webPageNode({
            url: pageUrl(routes.about, locale),
            name: page.title,
            description: page.description,
            locale,
            type: "AboutPage",
            about: ids.organization,
            breadcrumb: breadcrumbNode(site, [{ name: page.title, path: routes.about }], locale),
          }),
        )}
      />
    </SitePageView>
  );
}
