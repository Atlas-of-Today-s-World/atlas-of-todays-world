import { RichText } from "@/components/atlas/RichText";
import Link from "@/components/i18n/Link";
import { buttonVariants } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";
import { getMessagesFor, localeFrom } from "@/lib/i18n/request";
import { PatronsEmail } from "@/features/membership/components/PatronsEmail";
import { privateMetadata } from "@/features/seo/metadata";
import { routes } from "@/config/routes";

export async function generateMetadata({ params }: PageProps<"/[locale]/membership/manage">) {
  return privateMetadata((await getMessagesFor(await localeFrom(params))).patrons.manage.title);
}

/**
 * "(Manage Existing Donation)". With NEXT_PUBLIC_STRIPE_PORTAL_URL set it links
 * to Stripe's customer portal login: the donor enters their e-mail there and
 * Stripe sends them a link, so it works without an Atlas account. Without it,
 * the demo note and the contact address.
 */
export default async function ManageDonationPage({
  params,
}: PageProps<"/[locale]/membership/manage">) {
  const messages = await getMessagesFor(await localeFrom(params));
  const t = messages.patrons.manage;
  const portal = publicEnv.NEXT_PUBLIC_STRIPE_PORTAL_URL;
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-[34px] leading-tight font-bold">{t.title}</h1>
      <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-ink-soft)]">
        {portal ? t.leadLive : t.lead}
      </p>
      {portal ? (
        <a
          href={portal}
          rel="noopener"
          className={buttonVariants({ variant: "patron", className: "mt-6" })}
        >
          {t.open}
        </a>
      ) : (
        <p className="mt-4 rounded-lg bg-[var(--color-warning-soft)] px-4 py-3 text-[14px] font-semibold text-[var(--color-warning)]">
          {t.demo}
        </p>
      )}
      <p className="mt-6 text-[15px] text-[var(--color-ink-soft)]">
        <RichText text={t.help} values={{ email: <PatronsEmail /> }} />
      </p>
      <Link
        href={routes.membership}
        className={buttonVariants({ variant: "outline", className: "mt-10" })}
      >
        {messages.patrons.checkout.back}
      </Link>
    </main>
  );
}
