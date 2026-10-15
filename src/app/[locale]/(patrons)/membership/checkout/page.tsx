import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { localePath } from "@/features/i18n/config";
import { getMessagesFor, localeFrom } from "@/features/i18n/request";
import { DemoCheckout } from "@/features/membership/components/DemoCheckout";
import { getPatronSettings } from "@/features/membership/queries";
import { parseDonation } from "@/features/membership/schema";
import { routes } from "@/config/routes";

// Rendered per request: the proxy sends it a nonce CSP (ADR-025), which a static page couldn't carry.
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = (await getMessagesFor(await localeFrom(params))).patrons.checkout;
  return { title: t.title, robots: { index: false, follow: false } };
}

/**
 * DEMO checkout (no payment). Invalid amount or period — or one the donation
 * card no longer offers (patron_settings) → back to /membership.
 */
export default async function CheckoutPage({ params, searchParams }: Props) {
  const locale = await localeFrom(params);
  const [query, settings] = await Promise.all([searchParams, getPatronSettings()]);
  const donation = parseDonation(query, settings.donation);
  if (!donation) redirect(localePath(locale, routes.membership));
  return (
    <main>
      <DemoCheckout donation={donation} />
    </main>
  );
}
