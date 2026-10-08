import type { Metadata } from "next";
import { getAtlas } from "@/features/geography/queries";
import { format, getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { DevelogiCredit } from "@/components/DevelogiCredit";
import { JsonLd } from "@/components/JsonLd";
import { ORGANIZATION } from "@/config/organization";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbNode, graph, ids, pageUrl, webPageNode } from "@/lib/seo/jsonld";
import { routes } from "@/config/routes";

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = await localeFrom(params);
  const t = getMessages(locale).about;
  return pageMetadata({ locale, path: routes.about, title: t.title, description: t.description });
}

export default async function AboutPage({ params }: Params) {
  const locale = await localeFrom(params);
  const t = getMessages(locale).about;
  const { indicators } = await getAtlas(locale);
  return (
    <main className="prose-atlas max-w-2xl">
      <h1 className="font-display text-[34px] font-bold text-[var(--color-ink)]">{t.title}</h1>
      <p className="mt-4">{t.intro}</p>

      <h2 id="mission">{t.missionTitle}</h2>
      <p>{t.missionText}</p>

      <h2 id="data">{t.dataTitle}</h2>
      <p>{t.dataText}</p>
      <ul>
        {indicators.map((indicator) => (
          <li key={indicator.id}>
            <strong>{indicator.label}</strong> &mdash; {indicator.source} ({indicator.latestYear})
          </li>
        ))}
      </ul>

      <h2>{t.editorialTitle}</h2>
      <p>{t.editorialText}</p>

      <h2 id="editorial-standards">{t.standardsTitle}</h2>
      <p>{format(t.standardsText, { email: ORGANIZATION.email })}</p>

      <h2 id="cite">{t.citeTitle}</h2>
      <p>{t.citeText}</p>

      <h2 id="machine-readable">{t.machineTitle}</h2>
      <p>{t.machineText}</p>

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
        text={getMessages(locale).patrons.builtWith}
        label={getMessages(locale).patrons.builtWithLabel}
        className="mt-12 justify-start border-t border-[var(--color-line)] pt-6"
      />

      <JsonLd
        data={graph(
          webPageNode({
            url: pageUrl(routes.about, locale),
            name: t.title,
            description: t.description,
            locale,
            type: "AboutPage",
            about: ids.organization,
            breadcrumb: breadcrumbNode(
              [
                { name: "Atlas of Today's World", path: "/" },
                { name: t.title, path: routes.about },
              ],
              locale,
            ),
          }),
        )}
      />
    </main>
  );
}
