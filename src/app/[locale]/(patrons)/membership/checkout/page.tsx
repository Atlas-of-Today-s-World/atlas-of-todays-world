import { redirect } from "next/navigation";
import { localePath } from "@/lib/i18n/config";
import { getMessagesFor, localeFrom } from "@/lib/i18n/request";
import { DemoCheckout } from "@/features/membership/components/DemoCheckout";
import { getPatronSettings } from "@/features/membership/queries";
import { parseDonation } from "@/features/membership/schema";
import { privateMetadata } from "@/features/seo/metadata";
import { routes } from "@/config/routes";

// Rendered per request: the proxy sends it a nonce CSP (ADR-025), which a static page couldn't carry.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/membership/checkout">) {
  return privateMetadata((await getMessagesFor(await localeFrom(params))).patrons.checkout.title);
}

/**
 * DEMO checkout (no payment). Invalid amount or period — or one the donation
 * card no longer offers (patron_settings) → back to /membership.
 */
export default async function CheckoutPage({
  params,
  searchParams,
}: PageProps<"/[locale]/membership/checkout">) {
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
