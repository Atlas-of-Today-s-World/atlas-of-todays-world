import { getAtlas } from "@/features/geography/queries";
import { format, getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { DevelogiCredit } from "@/components/DevelogiCredit";
import { JsonLd } from "@/components/JsonLd";
import { ORGANIZATION } from "@/config/organization";
import { sitePageMetadata } from "@/features/site-pages/components/SitePage";
import { SitePageView } from "@/features/site-pages/components/SitePageView";
import { getSitePage } from "@/features/site-pages/queries";
import { breadcrumbNode, graph, ids, pageUrl, webPageNode } from "@/lib/seo/jsonld";
import { routes } from "@/config/routes";

type Params = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Params) {
  return sitePageMetadata("about", params);
}

/**
 * About the Atlas. The text is edited in the admin (Site pages); the live
 * list of data sources (at the body's {{data-sources}} paragraph) and the
 * publisher line stay in code.
 */
export default async function AboutPage({ params }: Params) {
  const locale = await localeFrom(params);
  const messages = getMessages(locale);
  const t = messages.about;
  const [page, { indicators }] = await Promise.all([getSitePage("about"), getAtlas(locale)]);
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
          legalName: ORGANIZATION.legalName,
          companyId: ORGANIZATION.companyId,
          address: `${ORGANIZATION.address.streetAddress}, ${ORGANIZATION.address.postalCode} ${ORGANIZATION.address.addressLocality}`,
          email: ORGANIZATION.email,
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
            breadcrumb: breadcrumbNode(
              [
                { name: "Atlas of Today's World", path: "/" },
                { name: page.title, path: routes.about },
              ],
              locale,
            ),
          }),
        )}
      />
    </SitePageView>
  );
}
