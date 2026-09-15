import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ContentRail from "@/components/ContentRail";
import MapFocus from "@/components/map/MapFocus";
import MapModeSetter from "@/components/map/MapModeSetter";
import { NewsBadge, SectionLabel } from "@/components/atlas-ui";
import { countryByIso3 } from "@/lib/countries";
import { allNews } from "@/lib/content";
import { allSpecialRegions, specialRegionBySlug } from "@/lib/special-regions";
import {
  absoluteUrl,
  alternates,
  breadcrumbJsonLd,
  geoCoordinates,
  geoMeta,
  jsonLdHtml,
} from "@/lib/seo";

// Vlastní celky vznikají v administraci, takže routa musí umět i slug,
// který v době buildu neexistoval.
export const dynamicParams = true;

export async function generateStaticParams() {
  const regions = await allSpecialRegions();
  return regions.map((region) => ({ slug: region.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const region = await specialRegionBySlug(slug);
  if (!region) return {};

  return {
    title: `${region.name} — ${region.subtitle}`,
    description: region.summary.slice(0, 180),
    alternates: alternates(`/special/${region.slug}`),
    openGraph: {
      title: `${region.name} — Atlas of Today's World`,
      description: region.summary.slice(0, 180),
      url: absoluteUrl(`/special/${region.slug}`),
    },
    other: geoMeta({
      lat: region.center[1],
      lon: region.center[0],
      placename: region.name,
    }),
  };
}

export default async function SpecialRegionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const region = await specialRegionBySlug(slug);
  if (!region) notFound();

  const countries = region.countries
    .map((iso3) => countryByIso3(iso3))
    .filter((country): country is NonNullable<typeof country> => country !== null)
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

  // Napřed novinky přiřazené přímo k celku (pole `special`), za nimi ty, které
  // se trefily některou ze zemí celku. Bez duplicit.
  const members = new Set(region.countries);
  const news = await allNews();
  const tagged = news.filter((item) => item.special === region.slug);
  const related = [
    ...tagged,
    ...news.filter(
      (item) =>
        item.special !== region.slug &&
        (item.countries ?? []).some((iso3) => members.has(iso3)),
    ),
  ];

  const population = countries.reduce(
    (sum, country) => sum + (country.population ?? 0),
    0,
  );

  return (
    <>
      <MapFocus
        center={region.center}
        zoom={region.zoom}
        regionCountries={region.countries}
        regionStroke={region.stroke}
      />
      <MapModeSetter mode="special" />

      <ContentRail>
        <article className="px-6 pb-10 pt-6">
          <SectionLabel>Special region</SectionLabel>

          <h1 className="mt-4 font-display text-[26px] font-bold leading-tight text-[var(--color-ink)]">
            {region.name}
          </h1>
          <p className="mt-1 font-display text-[15px] font-bold text-[var(--color-link)]">
            {region.subtitle}
          </p>

          <div
            className="mt-4 h-2 w-full rounded-full"
            style={{ background: region.fill }}
            aria-hidden
          />

          <p className="mt-4 text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
            {region.summary}
          </p>

          <div className="mt-4">
            <NewsBadge count={related.length} />
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--color-line)] pt-5 text-[12.5px]">
            <div>
              <dt className="text-[var(--color-ink-muted)]">Countries</dt>
              <dd className="font-medium text-[var(--color-ink)]">
                {countries.length}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Combined population</dt>
              <dd className="font-medium text-[var(--color-ink)]">
                {population >= 1e9
                  ? `${(population / 1e9).toFixed(2)} bn`
                  : `${(population / 1e6).toFixed(0)} m`}
              </dd>
            </div>
          </dl>

          <h2 className="mt-7 font-display text-[15px] font-bold text-[var(--color-ink)]">
            Countries in this group
          </h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {countries.map((country) => (
              <Link
                key={country.iso3}
                href={`/country/${country.slug}`}
                className="rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[12px] text-[var(--color-ink-soft)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              >
                {country.name}
              </Link>
            ))}
          </div>

          {related.length ? (
            <>
              <h2 className="mt-7 font-display text-[15px] font-bold text-[var(--color-ink)]">
                News from this group
              </h2>
              <ul className="mt-3 grid gap-2">
                {related.map((item) => (
                  <li key={item.slug}>
                    <Link
                      href={`/news/${item.slug}`}
                      className="group block rounded-xl border border-[var(--color-line)] p-3 transition hover:border-[var(--color-accent)]"
                    >
                      <span className="text-[10.5px] uppercase tracking-wide text-[var(--color-ink-muted)]">
                        {item.category}
                      </span>
                      <span className="mt-0.5 block text-[13.5px] font-medium text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
                        {item.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <p className="mt-8 text-[11.5px] text-[var(--color-ink-muted)]">
            Special regions are assembled by the Atlas team and can cross the
            boundaries of the nine Atlas regions.{" "}
            <Link href="/admin" className="text-[var(--color-link)] hover:underline">
              Edit them in the administration
            </Link>
            .
          </p>
        </article>
      </ContentRail>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml([
            {
              "@context": "https://schema.org",
              "@type": "Place",
              name: region.name,
              alternateName: region.subtitle,
              description: region.summary,
              url: absoluteUrl(`/special/${region.slug}`),
              geo: geoCoordinates(region.center[1], region.center[0]),
              containsPlace: countries.map((country) => ({
                "@type": "Country",
                name: country.name,
                url: absoluteUrl(`/country/${country.slug}`),
              })),
            },
            breadcrumbJsonLd([
              { name: "Atlas of Today's World", path: "/" },
              { name: region.name, path: `/special/${region.slug}` },
            ]),
          ]),
        }}
      />
    </>
  );
}
