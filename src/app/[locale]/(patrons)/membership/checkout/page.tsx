import { redirect } from "next/navigation";
import { localePath } from "@/lib/i18n/config";
import { getMessagesFor, localeFrom } from "@/lib/i18n/request";
import { stripeEnabled } from "@/lib/stripe";
import { CheckoutRetry } from "@/features/membership/components/CheckoutRetry";
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
 * Without Stripe: the DEMO checkout (no payment). With Stripe: payment happens
 * on Stripe's page, and this page only explains a Checkout that couldn't be
 * opened (`?error=busy|failed`). Invalid amount or period — or one the
 * donation card no longer offers (patron_settings) → back to /membership.
 */
export default async function CheckoutPage({
  params,
  searchParams,
}: PageProps<"/[locale]/membership/checkout">) {
  const locale = await localeFrom(params);
  const [query, settings] = await Promise.all([searchParams, getPatronSettings()]);
  const donation = parseDonation(query, settings.donation);
  if (!donation) redirect(localePath(locale, routes.membership));
  if (stripeEnabled()) {
    return (
      <main>
        <CheckoutRetry
          donation={donation}
          reason={query.error === "busy" ? "busy" : "failed"}
          locale={locale}
          messages={await getMessagesFor(locale)}
        />
      </main>
    );
  }
  return (
    <main>
      <DemoCheckout donation={donation} />
    </main>
  );
}
