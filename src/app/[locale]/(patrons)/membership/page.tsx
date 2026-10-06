import type { Metadata } from "next";
import { ArrowRight, Mail, PenLine } from "lucide-react";
import { DevelogiCredit } from "@/components/DevelogiCredit";
import Link from "@/components/i18n/Link";
import { NEWSLETTER_PATH } from "@/config/navigation";
import { getFlags } from "@/features/flags/queries";
import { VolunteerForm } from "@/features/volunteers/components/VolunteerForm";
import { VOLUNTEER_ID } from "@/features/membership/config";
import { Accordion } from "@/components/atlas/Accordion";
import { RichText } from "@/components/atlas/RichText";
import { DonationCard } from "@/components/membership/DonationCard";
import { buttonVariants } from "@/components/ui/button";
import type { Locale } from "@/features/i18n/config";
import { format, getMessages, type Messages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { startCheckout } from "@/features/membership/actions";
import { PatronsEmail } from "@/features/membership/components/PatronsEmail";
import { GOAL, MEMBERSHIP_PATH } from "@/features/membership/config";
import { getPatronStats, type PatronStats } from "@/features/membership/queries";
import { cn } from "@/lib/cn";
import { formatEuro, formatNumber, formatPercent } from "@/lib/format";
import { JsonLd } from "@/components/JsonLd";
import { ORGANIZATION } from "@/config/organization";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbNode, faqNode, graph, ids, pageUrl, webPageNode } from "@/lib/seo/jsonld";

type Params = { params: Promise<{ locale: string }> };

/** Id of the bottom donation card ("Donate and Join" in the hero scrolls there). */
const JOIN_ID = "join";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = await localeFrom(params);
  const t = getMessages(locale).patrons;
  return pageMetadata({
    locale,
    path: MEMBERSHIP_PATH,
    title: t.title,
    description: t.description,
    ownImage: true,
  });
}

/** The original site's faint world map, self-hosted (public/brand). */
function WorldMap({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- decorative static SVG
    <img
      src="/brand/world-map.svg"
      alt=""
      aria-hidden
      width={1280}
      height={770}
      className={cn(
        "pointer-events-none absolute left-1/2 w-[80rem] max-w-none -translate-x-1/2 select-none",
        className,
      )}
    />
  );
}

const H2 = "font-display text-[28px] font-bold sm:text-[32px]";
const CARD = "rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-white";

/** Big graphic link to the newsletter page — for readers not ready to give yet. */
function NewsletterBanner({ t }: { t: Messages["patrons"]["newsletter"] }) {
  return (
    <Link
      href={NEWSLETTER_PATH}
      aria-labelledby="newsletter-banner-title"
      className="group relative isolate mt-20 flex flex-col gap-6 overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_85%_20%,var(--color-patron-bright)_0%,var(--color-patron)_35%,var(--color-space)_90%)] p-7 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:outline-none sm:flex-row sm:items-center sm:justify-between sm:p-10"
    >
      <Mail
        aria-hidden
        className="absolute -right-6 -bottom-10 -z-10 size-56 text-white/10 transition group-hover:-rotate-6"
      />
      <span className="max-w-2xl">
        <span className="flex items-center gap-2.5 text-[12px] font-medium tracking-[0.12em] text-white/70 uppercase">
          <span className="grid size-9 place-items-center rounded-xl bg-white/15">
            <Mail aria-hidden className="size-5" />
          </span>
          {t.eyebrow}
        </span>
        <span
          id="newsletter-banner-title"
          className="font-display mt-4 block text-[26px] leading-tight font-bold sm:text-[32px]"
        >
          {t.title}
        </span>
        <span className="mt-3 block text-[15px] leading-relaxed text-white/85">{t.text}</span>
      </span>
      <span className="inline-flex min-h-12 shrink-0 items-center gap-2 self-start rounded-full bg-white px-6 text-[15px] font-semibold text-[var(--color-space)] transition group-hover:bg-[var(--color-gold-light)] sm:self-center">
        {t.cta}
        <ArrowRight aria-hidden className="size-4 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function Goal({
  t,
  locale,
  stats,
}: {
  t: Messages["patrons"]["goal"];
  locale: Locale;
  stats: PatronStats | null;
}) {
  const percent = stats ? Math.min(100, Math.round((stats.monthlyEur / GOAL.monthlyEur) * 100)) : 0;
  const goalEur = formatEuro(GOAL.monthlyEur, locale);
  return (
    <section aria-labelledby="goal-title" className="mt-20">
      <h2 id="goal-title" className={H2}>
        {t.title}
      </h2>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="rounded-[var(--radius-panel)] bg-[var(--color-patron)] p-6 text-white">
          <p className="inline-block rounded-full bg-[var(--color-ink)] px-3 py-1 text-[13px] font-semibold">
            {format(t.pill, { patrons: formatNumber(GOAL.patrons, 0, locale), amount: goalEur })}
          </p>
          <h3 className="font-display mt-4 text-[22px] leading-tight font-bold">{t.name}</h3>
          <p className="mt-4 text-[14px] leading-relaxed">
            <RichText text={t.lead} />
          </p>
          <p className="mt-4 text-[14px] leading-relaxed">
            <RichText text={t.listIntro} />
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-[14px] leading-relaxed">
            {t.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>

        <div className={cn(CARD, "grid gap-8 p-6 sm:grid-cols-2 sm:p-8 lg:my-6")}>
          <div>
            <h3 className="text-[13px] font-semibold tracking-wide uppercase">{t.patronsLabel}</h3>
            <p className="mt-2 text-[28px] font-bold">
              {stats ? formatNumber(stats.patrons, 0, locale) : "—"}
              <span className="font-normal text-[var(--color-ink-muted)]">
                {" "}
                / {formatNumber(GOAL.patrons, 0, locale)}
              </span>
            </p>
            <p className="mt-1 text-[14px] text-[var(--color-ink-soft)]">{t.joined}</p>
          </div>
          <div>
            <h3 className="text-[13px] font-semibold tracking-wide uppercase">{t.progressLabel}</h3>
            <p className="mt-2 text-[28px] font-bold">
              {stats ? formatEuro(stats.monthlyEur, locale) : "—"}
            </p>
            <p className="text-[18px] text-[var(--color-ink-muted)]">
              {format(t.ofMonthly, { amount: goalEur })}
            </p>
            <div
              role="progressbar"
              aria-label={t.progressAria}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="mt-5 h-3 overflow-hidden rounded-full bg-[var(--color-line)]/60"
            >
              <div
                className="h-full rounded-full bg-[var(--color-patron)]"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-1 text-[13px] font-semibold text-[var(--color-patron)]">
              {formatPercent(percent, locale)}
            </p>
            <p className="mt-4 text-[13px] text-[var(--color-ink-soft)]">{t.note}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Atlas Patrons (membership / donations), modelled on the original
 * atlasoftodaysworld.org/membership page. Static with ISR; only the goal
 * numbers come from the database (cached under tags.patrons).
 */
export default async function MembershipPage({ params }: Params) {
  const locale = await localeFrom(params);
  const t = getMessages(locale).patrons;
  const [stats, flags] = await Promise.all([getPatronStats(), getFlags()]);

  return (
    <main>
      <div className="relative overflow-hidden">
        <WorldMap className="top-0" />
        <div className="relative mx-auto max-w-6xl px-6 pt-12 pb-20 sm:pt-16">
          {/* Hero */}
          <section className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,28rem)]">
            <div>
              <h1 className="font-display text-[36px] leading-[1.1] font-bold sm:text-[48px]">
                {t.heroTitle}
                <span className="block text-[var(--color-patron)]">{t.heroTitleAccent}</span>
              </h1>
              {t.heroLead.map((paragraph) => (
                <p
                  key={paragraph}
                  className="mt-5 max-w-md text-[16px] leading-relaxed text-[var(--color-ink-soft)]"
                >
                  <RichText text={paragraph} />
                </p>
              ))}
              <a
                href={`#${JOIN_ID}`}
                className={buttonVariants({ variant: "patron", className: "mt-8" })}
              >
                {t.heroCta}
              </a>
            </div>
            <DonationCard action={startCheckout} />
          </section>

          {/* As a Patron, You Will: */}
          <section aria-labelledby="benefits-title" className="mt-20">
            <h2 id="benefits-title" className={H2}>
              {t.benefitsTitle}
            </h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-2">
              {t.benefits.map((benefit, index) => (
                <li key={benefit.title} className={cn(CARD, "p-6 sm:p-8")}>
                  <h3 className="font-display flex items-center gap-3 text-[18px] font-bold">
                    <span
                      aria-hidden
                      className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-[var(--color-patron)] text-[14px] text-[var(--color-patron)]"
                    >
                      {index + 1}
                    </span>
                    {benefit.title}
                  </h3>
                  {benefit.text.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="mt-4 text-[15px] leading-relaxed text-[var(--color-ink-soft)]"
                    >
                      <RichText text={paragraph} />
                    </p>
                  ))}
                </li>
              ))}
            </ol>
          </section>

          <Goal t={t.goal} locale={locale} stats={stats} />

          {flags.newsletter ? <NewsletterBanner t={t.newsletter} /> : null}

          <section aria-labelledby="faq-title" className="mt-20">
            <h2 id="faq-title" className={H2}>
              {t.faqTitle}
            </h2>
            <div className="mt-8">
              <Accordion
                size="comfortable"
                items={t.faq.map((item) => ({
                  question: item.question,
                  answer: <RichText text={item.answer} values={{ email: <PatronsEmail /> }} />,
                }))}
              />
            </div>
          </section>

          {/* Another way to help: volunteer editors (applications land in the admin). */}
          <section
            id={VOLUNTEER_ID}
            aria-labelledby="volunteer-title"
            className="mt-20 scroll-mt-24 rounded-3xl bg-[var(--color-surface-muted)] p-6 ring-1 ring-black/5 sm:p-10"
          >
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
              <div>
                <h2 id="volunteer-title" className={H2}>
                  {t.volunteer.title}
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
                  {t.volunteer.lead}
                </p>
                <ul className="mt-6 space-y-2.5 text-[14px] text-[var(--color-ink)]">
                  {t.volunteer.points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5">
                      <PenLine
                        aria-hidden
                        className="mt-0.5 size-4 shrink-0 text-[var(--color-accent)]"
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              <VolunteerForm />
            </div>
          </section>
        </div>
      </div>

      <JsonLd
        data={graph(
          {
            ...webPageNode({
              url: pageUrl(MEMBERSHIP_PATH, locale),
              name: t.title,
              description: t.description,
              locale,
              about: ids.organization,
              breadcrumb: breadcrumbNode(
                [
                  { name: "Atlas of Today's World", path: "/" },
                  { name: t.title, path: MEMBERSHIP_PATH },
                ],
                locale,
              ),
            }),
            potentialAction: {
              "@type": "DonateAction",
              name: t.heroCta,
              target: pageUrl(MEMBERSHIP_PATH, locale),
              recipient: { "@id": ids.organization },
            },
          },
          faqNode(
            pageUrl(MEMBERSHIP_PATH, locale),
            // Plain text for robots: the {email} placeholder filled in, **bold** markers dropped.
            t.faq.map((item) => ({
              question: item.question,
              answer: item.answer.replace(/\{email\}/g, ORGANIZATION.email).replace(/\*\*/g, ""),
            })),
          ),
        )}
      />

      {/* Closing band with the same donation card. */}
      <section
        id={JOIN_ID}
        aria-labelledby="join-title"
        className="relative scroll-mt-4 overflow-hidden bg-[var(--color-space)] text-white"
      >
        <WorldMap className="top-1/2 -translate-y-1/2 opacity-10" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 sm:py-24 lg:grid-cols-[1fr_minmax(0,28rem)]">
          <h2
            id="join-title"
            className="font-display text-[36px] leading-[1.1] font-bold sm:text-[48px]"
          >
            {t.finalTitle}
            <span className="block text-[var(--color-patron-bright)]">{t.finalTitleAccent}</span>
          </h2>
          <DonationCard action={startCheckout} />
        </div>
      </section>

      {/* Credit: the website was built in cooperation with Develogi.cz. */}
      <div className="bg-white">
        <DevelogiCredit
          text={t.builtWith}
          label={t.builtWithLabel}
          className="mx-auto max-w-6xl px-6 py-8"
        />
      </div>
    </main>
  );
}
