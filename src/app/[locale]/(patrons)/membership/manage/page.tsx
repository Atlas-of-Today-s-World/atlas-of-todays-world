import { RichText } from "@/components/atlas/RichText";
import Link from "@/components/i18n/Link";
import { buttonVariants } from "@/components/ui/button";
import { getMessagesFor, localeFrom } from "@/lib/i18n/request";
import { PatronsEmail } from "@/features/membership/components/PatronsEmail";
import { privateMetadata } from "@/features/seo/metadata";
import { routes } from "@/config/routes";

export async function generateMetadata({ params }: PageProps<"/[locale]/membership/manage">) {
  return privateMetadata((await getMessagesFor(await localeFrom(params))).patrons.manage.title);
}

/**
 * DEMO "(Manage Existing Donation)". With Stripe (ADR G6) the link becomes a
 * Server Action that creates a billing-portal session and redirects to it.
 */
export default async function ManageDonationPage({
  params,
}: PageProps<"/[locale]/membership/manage">) {
  const messages = await getMessagesFor(await localeFrom(params));
  const t = messages.patrons.manage;
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-[34px] leading-tight font-bold">{t.title}</h1>
      <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-ink-soft)]">{t.lead}</p>
      <p className="mt-4 rounded-lg bg-[var(--color-warning-soft)] px-4 py-3 text-[14px] font-semibold text-[var(--color-warning)]">
        {t.demo}
      </p>
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
