import type { Metadata } from "next";
import { ArrowRight, Check, HandHeart, Mail, PenLine } from "lucide-react";
import Link from "@/components/i18n/Link";
import NewsletterForm from "@/components/NewsletterForm";
import { NEWSLETTER_PATH } from "@/config/navigation";
import { getFlags } from "@/features/flags/queries";
import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { MEMBERSHIP_PATH, VOLUNTEER_ID } from "@/features/membership/config";
import { pageMetadata } from "@/lib/seo/metadata";

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = await localeFrom(params);
  const t = getMessages(locale).newsletterPage;
  return pageMetadata({
    locale,
    path: NEWSLETTER_PATH,
    title: t.metaTitle,
    description: t.description,
  });
}

/** Two ways to do more, as graphic cards under the sign-up. */
const CARD =
  "group relative isolate flex min-h-56 flex-col justify-end overflow-hidden rounded-3xl p-7 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:outline-none";

/**
 * Newsletter sign-up: what it brings, the form (Mailchimp, double opt-in) and
 * under it two graphic cards — support the Atlas, or write for it.
 */
export default async function NewsletterPage({ params }: Params) {
  const locale = await localeFrom(params);
  const t = getMessages(locale).newsletterPage;
  const flags = await getFlags();

  return (
    <>
      <section
        aria-labelledby="newsletter-title"
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
          <Mail className="size-6" />
        </span>
        <h1
          id="newsletter-title"
          className="font-display mt-5 text-[32px] leading-tight font-bold sm:text-[40px]"
        >
          {t.title}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/80">{t.lead}</p>
        <ul className="mt-5 space-y-2 text-[14px] text-white/90">
          {t.points.map((point) => (
            <li key={point} className="flex items-start gap-2.5">
              <Check
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-[var(--color-patron-bright)]"
              />
              {point}
            </li>
          ))}
        </ul>
        <div className="mt-7 max-w-md">
          {flags.newsletter ? (
            <NewsletterForm />
          ) : (
            <p className="rounded-xl bg-white/10 p-4 text-[14px] text-white/85">{t.off}</p>
          )}
          <p className="mt-3 text-[12px] text-white/55">{t.note}</p>
        </div>
      </section>

      <h2 className="font-display mt-14 text-[24px] font-bold">{t.moreTitle}</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Link
          href={MEMBERSHIP_PATH}
          className={`${CARD} bg-[radial-gradient(circle_at_80%_15%,var(--color-gold-light)_0%,var(--color-gold)_30%,var(--color-gold-deep)_75%)]`}
        >
          <HandHeart
            aria-hidden
            className="absolute -top-4 -right-4 -z-10 size-44 text-white/20 transition group-hover:rotate-6"
          />
          <span className="font-display text-[22px] leading-tight font-bold">{t.donateTitle}</span>
          <span className="mt-2 text-[14px] leading-relaxed text-white/90">{t.donateText}</span>
          <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold">
            {t.donateCta}
            <ArrowRight aria-hidden className="size-4 transition group-hover:translate-x-0.5" />
          </span>
        </Link>
        <Link
          href={`${MEMBERSHIP_PATH}#${VOLUNTEER_ID}`}
          className={`${CARD} bg-[radial-gradient(circle_at_80%_15%,var(--color-patron-bright)_0%,var(--color-patron)_40%,var(--color-space)_95%)]`}
        >
          <PenLine
            aria-hidden
            className="absolute -top-2 -right-2 -z-10 size-40 text-white/15 transition group-hover:-rotate-6"
          />
          <span className="font-display text-[22px] leading-tight font-bold">{t.editorTitle}</span>
          <span className="mt-2 text-[14px] leading-relaxed text-white/90">{t.editorText}</span>
          <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold">
            {t.editorCta}
            <ArrowRight aria-hidden className="size-4 transition group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>
    </>
  );
}
