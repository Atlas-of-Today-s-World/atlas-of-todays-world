import { ArrowRight, BriefcaseBusiness } from "lucide-react";
import Link from "@/components/i18n/Link";
import { JsonLd } from "@/components/JsonLd";
import { PositionFacts } from "@/features/careers/components/PositionFacts";
import { getOpenPositions } from "@/features/careers/queries";
import { getSiteSettings } from "@/features/site/queries";
import { breadcrumbNode, graph, ids, pageUrl, webPageNode } from "@/features/seo/jsonld";
import { staticPageMetadata } from "@/features/seo/metadata";
import { getMessagesFor, localeFrom } from "@/lib/i18n/request";
import { routes, VOLUNTEER_ID } from "@/config/routes";

export const generateMetadata = staticPageMetadata("careersPage", routes.careers);

/**
 * Careers: who we are looking for. The open positions from the admin (Admin →
 * Careers) as cards; each leads to its profile and application form. Without
 * any, the page points to the volunteer form and the newsletter instead.
 */
export default async function CareersPage({ params }: PageProps<"/[locale]/careers">) {
  const locale = await localeFrom(params);
  const t = (await getMessagesFor(locale)).careersPage;
  const [positions, site] = await Promise.all([getOpenPositions(), getSiteSettings()]);

  return (
    <>
      <section
        aria-labelledby="careers-title"
        className="relative isolate overflow-hidden rounded-3xl bg-[var(--color-space)] p-7 text-white sm:p-10"
      >
        {/* Faint rings of a globe behind the text. */}
        <span
          aria-hidden
          className="absolute -top-24 -right-24 -z-10 size-80 rounded-full border border-white/10 shadow-[0_0_0_40px_rgba(255,255,255,0.03),0_0_0_80px_rgba(255,255,255,0.02)]"
        />
        <span
          aria-hidden
          className="grid size-12 place-items-center rounded-2xl bg-[var(--color-patron)] text-white"
        >
          <BriefcaseBusiness className="size-6" />
        </span>
        <p className="mt-5 text-[12px] font-semibold tracking-[0.14em] text-white/60 uppercase">
          {t.kicker}
        </p>
        <h1
          id="careers-title"
          className="font-display mt-1 text-[32px] leading-tight font-bold sm:text-[40px]"
        >
          {t.title}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/80">{t.lead}</p>
      </section>

      <section aria-labelledby="careers-open" className="mt-12">
        <h2 id="careers-open" className="font-display text-[24px] font-bold">
          {t.openTitle}
        </h2>
        {positions.length ? (
          <ul className="mt-5 grid gap-4">
            {positions.map((position) => (
              <li key={position.slug}>
                <Link
                  href={routes.career(position.slug)}
                  className="group block rounded-2xl bg-white p-6 ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none sm:p-7"
                >
                  <span className="font-display text-[21px] leading-tight font-bold text-[var(--color-ink)]">
                    {position.title}
                  </span>
                  <PositionFacts
                    location={position.location}
                    jobType={position.job_type}
                    labels={t}
                  />
                  {position.summary ? (
                    <span className="mt-3 block max-w-3xl text-[14.5px] leading-relaxed text-[var(--color-ink-soft)]">
                      {position.summary}
                    </span>
                  ) : null}
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--color-accent)]">
                    {t.details}
                    <ArrowRight
                      aria-hidden
                      className="size-4 transition group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-5 rounded-2xl bg-[var(--color-surface-muted)] p-6 text-[14.5px] leading-relaxed text-[var(--color-ink-soft)] ring-1 ring-black/5">
            <p>{t.none}</p>
            <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-semibold">
              <Link
                href={`${routes.membership}#${VOLUNTEER_ID}`}
                className="text-[var(--color-link)] underline"
              >
                {t.noneVolunteer}
              </Link>
              <Link href={routes.newsletter} className="text-[var(--color-link)] underline">
                {t.noneNewsletter}
              </Link>
            </p>
          </div>
        )}
      </section>
      <JsonLd
        data={graph(
          webPageNode({
            url: pageUrl(routes.careers, locale),
            name: t.title,
            description: t.description,
            locale,
            about: ids.organization,
            breadcrumb: breadcrumbNode(site, [{ name: t.title, path: routes.careers }], locale),
          }),
        )}
      />
    </>
  );
}
