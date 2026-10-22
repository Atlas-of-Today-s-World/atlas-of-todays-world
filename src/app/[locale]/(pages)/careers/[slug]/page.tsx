import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { SafeHtml } from "@/components/atlas/SafeHtml";
import Link from "@/components/i18n/Link";
import { JsonLd } from "@/components/JsonLd";
import { buttonVariants } from "@/components/ui/button";
import { ApplicationForm } from "@/features/careers/components/ApplicationForm";
import { PositionFacts } from "@/features/careers/components/PositionFacts";
import { getOpenPosition, getOpenPositions } from "@/features/careers/queries";
import { redirectOrNotFound } from "@/features/redirects/queries";
import { getSiteSettings } from "@/features/site/queries";
import { breadcrumbNode, graph, ids, pageUrl, webPageNode } from "@/features/seo/jsonld";
import { pageMetadata } from "@/features/seo/metadata";
import { getMessagesFor, localeFrom } from "@/lib/i18n/request";
import { captchaEnabled } from "@/lib/security/turnstile";
import { routes } from "@/config/routes";

export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getOpenPositions()).map((position) => ({ slug: position.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/careers/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const locale = await localeFrom(params);
  const position = await getOpenPosition(slug);
  if (!position) return {};
  const t = (await getMessagesFor(locale)).careersPage;
  return pageMetadata({
    locale,
    path: routes.career(slug),
    title: `${position.title} — ${t.title}`,
    description: position.summary || t.description,
  });
}

/** Anchor of the application form (the "Apply now" link under the title jumps there). */
const APPLY_ID = "apply";

/**
 * One open position: its title and facts, the profile written in the admin
 * and, under it, the application form (name, e-mail, CV, message). A closed
 * or unknown position is a 404 (or the redirect an editor set for it).
 */
export default async function PositionPage({ params }: PageProps<"/[locale]/careers/[slug]">) {
  const { slug } = await params;
  const locale = await localeFrom(params);
  const position = await getOpenPosition(slug);
  if (!position) return redirectOrNotFound(routes.career(slug), locale);
  const t = (await getMessagesFor(locale)).careersPage;
  const site = await getSiteSettings();

  return (
    <>
      <Link
        href={routes.careers}
        className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[var(--color-link)] hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t.allPositions}
      </Link>
      <main className="mt-4 max-w-3xl">
        <h1 className="font-display text-[34px] leading-tight font-bold text-[var(--color-ink)]">
          {position.title}
        </h1>
        <PositionFacts
          location={position.location}
          jobType={position.job_type}
          labels={t}
          className="mt-3"
        />
        <a href={`#${APPLY_ID}`} className={`${buttonVariants({ size: "md" })} mt-5`}>
          {t.applyCta}
        </a>
        <SafeHtml html={position.body_html} className="prose-atlas mt-8" />
      </main>

      <section
        id={APPLY_ID}
        aria-labelledby="apply-title"
        className="mt-14 max-w-3xl scroll-mt-24 rounded-3xl bg-[var(--color-surface-muted)] p-6 ring-1 ring-black/5 sm:p-10"
      >
        <h2 id="apply-title" className="font-display text-[24px] font-bold">
          {t.applyTitle}
        </h2>
        <p className="mt-3 mb-6 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
          {t.applyLead}
        </p>
        <ApplicationForm positionId={position.id} captcha={captchaEnabled()} />
      </section>
      <JsonLd
        data={graph(
          webPageNode({
            url: pageUrl(routes.career(slug), locale),
            name: position.title,
            description: position.summary || t.description,
            locale,
            about: ids.organization,
            modified: position.updated_at,
            breadcrumb: breadcrumbNode(
              site,
              [
                { name: t.title, path: routes.careers },
                { name: position.title, path: routes.career(slug) },
              ],
              locale,
            ),
          }),
        )}
      />
    </>
  );
}
