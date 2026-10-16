import { CircleCheck } from "lucide-react";
import Link from "@/components/i18n/Link";
import { buttonVariants } from "@/components/ui/button";
import { format } from "@/lib/i18n/messages";
import { getMessagesFor, localeFrom } from "@/lib/i18n/request";
import { getPatronSettings } from "@/features/membership/queries";
import { parseDonation } from "@/features/membership/schema";
import { formatEuro } from "@/lib/format";
import { privateMetadata } from "@/features/seo/metadata";
import { stripeEnabled } from "@/lib/stripe";
import { TrackOnLoad } from "@/features/conversions/use-track";
import { routes } from "@/config/routes";

export async function generateMetadata({ params }: PageProps<"/[locale]/membership/thank-you">) {
  return privateMetadata((await getMessagesFor(await localeFrom(params))).patrons.thankYou.title);
}

/**
 * After the payment (Stripe's success URL, or the demo checkout). The amount
 * line is shown only for a valid donation. The membership itself comes from
 * the Stripe webhook, never from this page.
 */
export default async function ThankYouPage({
  params,
  searchParams,
}: PageProps<"/[locale]/membership/thank-you">) {
  const locale = await localeFrom(params);
  const messages = await getMessagesFor(locale);
  const t = messages.patrons.thankYou;
  const [query, settings] = await Promise.all([searchParams, getPatronSettings()]);
  const donation = parseDonation(query, settings.donation);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      {/* Counted only after a valid (demo) payment, not for a bare visit. */}
      {donation ? <TrackOnLoad event="checkout_complete" /> : null}
      <CircleCheck aria-hidden size={44} className="text-[var(--color-success)]" />
      <h1 className="font-display mt-4 text-[34px] leading-tight font-bold">{t.heading}</h1>
      {donation ? (
        <p className="mt-4 text-[17px] text-[var(--color-ink-soft)]">
          {format(donation.period === "monthly" ? t.leadMonthly : t.leadOneTime, {
            amount: formatEuro(donation.amount, locale),
          })}
        </p>
      ) : null}
      {stripeEnabled() ? null : (
        <p className="mt-2 text-[14px] font-semibold text-[var(--color-warning)]">{t.demoNote}</p>
      )}

      <h2 className="font-display mt-10 text-[20px] font-bold">{t.nextTitle}</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
        {/* Without a valid donation in the address, the general (monthly) list. */}
        {(donation?.period === "one-time" ? t.nextOneTime : t.nextMonthly).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/" className={buttonVariants({ variant: "patron" })}>
          {t.backToAtlas}
        </Link>
        <Link href={routes.membership} className={buttonVariants({ variant: "outline" })}>
          {messages.patrons.checkout.back}
        </Link>
      </div>
    </main>
  );
}
