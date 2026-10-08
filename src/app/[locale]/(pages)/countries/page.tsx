import type { Metadata } from "next";
import Link from "@/components/i18n/Link";
import { JsonLd } from "@/components/JsonLd";
import { buttonVariants } from "@/components/ui/button";
import { COUNTRIES_PATH } from "@/config/navigation";
import { getAtlas } from "@/features/geography/queries";
import type { Country } from "@/features/geography/types";
import { format, getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbNode, graph, itemListNode, pageUrl, webPageNode } from "@/lib/seo/jsonld";

type Params = { params: Promise<{ locale: string }> };

/** The same chip as a portrait's country list. */
const CHIP = buttonVariants({ variant: "outline", size: "chip" });

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = await localeFrom(params);
  const t = getMessages(locale).countriesIndex;
  return pageMetadata({ locale, path: COUNTRIES_PATH, title: t.title, description: t.description });
}

/**
 * Every world region with its countries, and the global issues, as plain links:
 * the way to any profile without the globe (keyboard, screen readers, no WebGL).
 */
export default async function CountriesPage({ params }: Params) {
  const locale = await localeFrom(params);
  const t = getMessages(locale).countriesIndex;
  const atlas = await getAtlas(locale);
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, locale);
  const issueGroups = [
    { key: "issues", title: t.issues, items: atlas.issues.filter((i) => i.kind === "issue") },
    {
      key: "specialRegions",
      title: t.specialRegions,
      items: atlas.issues.filter((i) => i.kind === "region"),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <main>
      <h1 className="font-display text-[34px] font-bold">{t.heading}</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
        {t.intro}{" "}
        {format(t.count, {
          countries: String(atlas.countries.length),
          regions: String(atlas.regions.length),
        })}
      </p>

      {atlas.regions.map((region) => {
        const countries = region.countries
          .map((iso3) => atlas.countryByIso3.get(iso3))
          .filter((country): country is Country => Boolean(country))
          .sort(byName);
        return (
          <section key={region.slug} aria-labelledby={`region-${region.slug}`} className="mt-10">
            <h2 id={`region-${region.slug}`} className="font-display text-[18px] font-bold">
              <Link
                href={`/region/${region.slug}`}
                className="inline-flex min-h-(--touch-min) items-center hover:text-[var(--color-accent)] hover:underline"
              >
                {region.name}
              </Link>
            </h2>
            {region.tagline ? (
              <p className="mt-1 text-[13px] text-[var(--color-ink-muted)]">{region.tagline}</p>
            ) : null}
            {countries.length ? (
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {countries.map((country) => (
                  <li key={country.iso3}>
                    <Link href={`/country/${country.slug}`} className={CHIP}>
                      {country.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}

      {issueGroups.map((group) => (
        <section
          key={group.key}
          aria-labelledby={group.key}
          className="mt-12 border-t border-[var(--color-line)] pt-8"
        >
          <h2 id={group.key} className="font-display text-[18px] font-bold">
            {group.title}
          </h2>
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {[...group.items].sort(byName).map((issue) => (
              <li key={issue.slug}>
                <Link href={`/global-issue/${issue.slug}`} className={CHIP}>
                  {issue.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <JsonLd
        data={graph(
          webPageNode({
            url: pageUrl(COUNTRIES_PATH, locale),
            name: t.heading,
            description: t.description,
            locale,
            type: "CollectionPage",
            breadcrumb: breadcrumbNode(
              [
                { name: "Atlas of Today's World", path: "/" },
                { name: t.heading, path: COUNTRIES_PATH },
              ],
              locale,
            ),
          }),
          itemListNode(t.heading, [
            ...atlas.regions.map((region) => ({
              name: region.name,
              url: pageUrl(`/region/${region.slug}`, locale),
            })),
            ...[...atlas.countries].sort(byName).map((country) => ({
              name: country.name,
              url: pageUrl(`/country/${country.slug}`, locale),
            })),
            ...atlas.issues.map((issue) => ({
              name: issue.name,
              url: pageUrl(`/global-issue/${issue.slug}`, locale),
            })),
          ]),
        )}
      />
    </main>
  );
}
